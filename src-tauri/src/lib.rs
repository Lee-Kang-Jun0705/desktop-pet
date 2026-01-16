use mouce::common::{MouseButton, MouseEvent};
use mouce::Mouse as OtherMouse;
use mouce::MouseActions;
use mouse_position::mouse_position::Mouse;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri_plugin_opener::OpenerExt;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, Serialize)]
struct MousePayload {
    x: i32,
    y: i32,
}

static CLICK_THROUGH: AtomicBool = AtomicBool::new(true);

#[tauri::command]
fn set_click_through(enabled: bool, window: tauri::Window) -> Result<(), String> {
    CLICK_THROUGH.store(enabled, Ordering::SeqCst);
    window
        .set_ignore_cursor_events(enabled)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_click_through() -> bool {
    CLICK_THROUGH.load(Ordering::SeqCst)
}

#[tauri::command]
fn get_mouse_position() -> Option<MousePayload> {
    match Mouse::get_mouse_position() {
        Mouse::Position { x, y } => Some(MousePayload { x, y }),
        Mouse::Error => None,
    }
}

#[derive(Clone, Serialize, Deserialize)]
struct ScreenInfo {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[tauri::command]
fn get_all_monitors(window: tauri::Window) -> Result<Vec<ScreenInfo>, String> {
    let monitors = window.available_monitors().map_err(|e| e.to_string())?;
    let mut screens = Vec::new();

    for monitor in monitors {
        let scale = monitor.scale_factor();
        let pos = monitor.position().to_logical::<f64>(scale);
        let size = monitor.size().to_logical::<f64>(scale);
        screens.push(ScreenInfo {
            x: pos.x.round() as i32,
            y: pos.y.round() as i32,
            width: size.width.round() as u32,
            height: size.height.round() as u32,
        });
    }

    Ok(screens)
}

#[tauri::command]
fn set_window_bounds(window: tauri::Window, x: i32, y: i32, width: u32, height: u32) -> Result<(), String> {
    use tauri::{LogicalPosition, LogicalSize};

    window.set_position(LogicalPosition::new(x, y)).map_err(|e| e.to_string())?;
    window.set_size(LogicalSize::new(width, height)).map_err(|e| e.to_string())?;

    Ok(())
}

fn listen_for_mouse_events(app_handle: AppHandle) {
    std::thread::spawn(move || {
        let mut mouse_manager = OtherMouse::new();
        let app_for_hook = app_handle.clone();
        let hook_result = mouse_manager.hook(Box::new(move |e| match e {
            MouseEvent::Press(MouseButton::Left) => {
                let position = Mouse::get_mouse_position();
                match position {
                    Mouse::Position { x, y } => {
                        let _ = app_for_hook.emit("mouse_click", MousePayload { x, y });
                    }
                    Mouse::Error => {
                        eprintln!("Error getting mouse position");
                    }
                }
            }
            _ => (),
        }));

        if let Err(err) = hook_result {
            eprintln!("Mouse hook error: {:?}", err);
            let _ = app_handle.emit("mouse_hook_error", format!("{err:?}"));
            return;
        }

        loop {
            std::thread::sleep(std::time::Duration::from_secs(1));
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            set_click_through,
            get_click_through,
            get_mouse_position,
            get_all_monitors,
            set_window_bounds
        ])
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("Failed to get main window");

            // 기본적으로 클릭 통과 활성화 (다른 앱 클릭 방해 없음)
            window
                .set_ignore_cursor_events(true)
                .expect("Failed to set ignore cursor events");
            CLICK_THROUGH.store(true, Ordering::SeqCst);

            // 시스템 트레이 메뉴 설정
            let quit = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let mode_auto = MenuItem::with_id(app, "mode_auto", "자동 모드", true, None::<&str>)?;
            let mode_on = MenuItem::with_id(app, "mode_on", "클릭 통과 ON", true, None::<&str>)?;
            let mode_off = MenuItem::with_id(app, "mode_off", "클릭 통과 OFF", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&mode_auto, &mode_on, &mode_off, &quit])?;

            let tray_icon = Image::from_bytes(include_bytes!("../icons/tray-template.png"))
                .map(|img| img.to_owned())
                .unwrap_or_else(|_| app.default_window_icon().unwrap().clone());

            let _tray = TrayIconBuilder::new()
                .icon(tray_icon)
                .icon_as_template(true)
                .title("Pet")
                .menu(&menu)
                .tooltip("Desktop Pet - 우클릭으로 메뉴")
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "mode_auto" => {
                        CLICK_THROUGH.store(true, Ordering::SeqCst);
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.set_ignore_cursor_events(true);
                            let _ = app.emit("click_through_changed", true);
                            let _ = app.emit("click_through_mode_changed", "auto");
                        }
                    }
                    "mode_on" => {
                        CLICK_THROUGH.store(true, Ordering::SeqCst);
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.set_ignore_cursor_events(true);
                            let _ = app.emit("click_through_changed", true);
                            let _ = app.emit("click_through_mode_changed", "locked_on");
                        }
                    }
                    "mode_off" => {
                        CLICK_THROUGH.store(false, Ordering::SeqCst);
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.set_ignore_cursor_events(false);
                            let _ = app.emit("click_through_changed", false);
                            let _ = app.emit("click_through_mode_changed", "locked_off");
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            // 마우스 이벤트 리스닝 시작
            let app_handle = app.handle().clone();
            listen_for_mouse_events(app_handle);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
