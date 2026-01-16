use mouce::common::{MouseButton, MouseEvent};
use mouce::Mouse as OtherMouse;
use mouce::MouseActions;
use mouse_position::mouse_position::Mouse;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
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
        let pos = monitor.position();
        let size = monitor.size();
        screens.push(ScreenInfo {
            x: pos.x,
            y: pos.y,
            width: size.width,
            height: size.height,
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

        let _ = mouse_manager.hook(Box::new(move |e| match e {
            MouseEvent::Press(MouseButton::Left) => {
                let position = Mouse::get_mouse_position();
                match position {
                    Mouse::Position { x, y } => {
                        let _ = app_handle.emit("mouse_click", MousePayload { x, y });
                    }
                    Mouse::Error => {
                        eprintln!("Error getting mouse position");
                    }
                }
            }
            _ => (),
        }));

        loop {
            std::thread::sleep(std::time::Duration::from_secs(1));
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            set_click_through,
            get_click_through,
            get_all_monitors,
            set_window_bounds
        ])
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("Failed to get main window");

            // 기본적으로 클릭 통과 비활성화 (펫 조작 가능)
            window
                .set_ignore_cursor_events(false)
                .expect("Failed to set ignore cursor events");
            CLICK_THROUGH.store(false, Ordering::SeqCst);

            // 시스템 트레이 메뉴 설정
            let quit = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let toggle_click = MenuItem::with_id(app, "toggle_click", "펫 조작 모드", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle_click, &quit])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Desktop Pet - 우클릭으로 메뉴")
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "toggle_click" => {
                        let current = CLICK_THROUGH.load(Ordering::SeqCst);
                        let new_value = !current;
                        CLICK_THROUGH.store(new_value, Ordering::SeqCst);
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.set_ignore_cursor_events(new_value);
                            let _ = app.emit("click_through_changed", new_value);
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
