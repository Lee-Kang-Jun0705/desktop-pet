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
fn get_mouse_position(window: tauri::Window) -> Option<MousePayload> {
    let scale = window.scale_factor().ok().unwrap_or(1.0);
    if let Ok(pos) = window.cursor_position() {
        return Some(MousePayload {
            x: (pos.x / scale).round() as i32,
            y: (pos.y / scale).round() as i32,
        });
    }

    match Mouse::get_mouse_position() {
        Mouse::Position { x, y } => Some(MousePayload { x, y }),
        Mouse::Error => None,
    }
}

#[tauri::command]
fn get_window_position(window: tauri::Window) -> Result<MousePayload, String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    Ok(MousePayload {
        x: (pos.x as f64 / scale).round() as i32,
        y: (pos.y as f64 / scale).round() as i32,
    })
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
    let scale = window.scale_factor().map_err(|e| e.to_string())?;

    for monitor in monitors {
        let pos = monitor.position();
        let size = monitor.size();
        screens.push(ScreenInfo {
            x: (pos.x as f64 / scale).round() as i32,
            y: (pos.y as f64 / scale).round() as i32,
            width: (size.width as f64 / scale).round() as u32,
            height: (size.height as f64 / scale).round() as u32,
        });
    }

    Ok(screens)
}

#[tauri::command]
fn get_primary_monitor(window: tauri::Window) -> Result<Option<ScreenInfo>, String> {
    let monitor = window.primary_monitor().map_err(|e| e.to_string())?;
    let Some(monitor) = monitor else {
        return Ok(None);
    };

    let scale = monitor.scale_factor();
    let pos = monitor.position();
    let size = monitor.size();

    Ok(Some(ScreenInfo {
        x: (pos.x as f64 / scale).round() as i32,
        y: (pos.y as f64 / scale).round() as i32,
        width: (size.width as f64 / scale).round() as u32,
        height: (size.height as f64 / scale).round() as u32,
    }))
}

#[tauri::command]
fn set_window_bounds(window: tauri::Window, x: i32, y: i32, width: u32, height: u32) -> Result<(), String> {
    use tauri::{LogicalPosition, LogicalSize};

    window.set_position(LogicalPosition::new(x, y)).map_err(|e| e.to_string())?;
    window.set_size(LogicalSize::new(width, height)).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn open_accessibility_settings(app: tauri::AppHandle) -> Result<(), String> {
    let url = "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";
    app.opener()
        .open_url(url, None::<String>)
        .map_err(|e| e.to_string())
}

fn listen_for_mouse_events(app_handle: AppHandle) {
    std::thread::spawn(move || {
        let mut mouse_manager = OtherMouse::new();
        let app_for_hook = app_handle.clone();
        let hook_result = mouse_manager.hook(Box::new(move |e| match e {
            MouseEvent::Press(MouseButton::Left) => {
                if let Some(win) = app_for_hook.get_webview_window("main") {
                    let scale = win.scale_factor().ok().unwrap_or(1.0);
                    if let Ok(pos) = win.cursor_position() {
                        let x = (pos.x / scale).round() as i32;
                        let y = (pos.y / scale).round() as i32;
                        let _ = app_for_hook.emit("mouse_click", MousePayload { x, y });
                        return;
                    }
                }

                let position = Mouse::get_mouse_position();
                if let Mouse::Position { x, y } = position {
                    let _ = app_for_hook.emit("mouse_click", MousePayload { x, y });
                } else {
                    eprintln!("Error getting mouse position");
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
            get_window_position,
            open_accessibility_settings,
            get_all_monitors,
            get_primary_monitor,
            set_window_bounds
        ])
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("Failed to get main window");

            if let Ok(Some(monitor)) = window.primary_monitor() {
                let scale = monitor.scale_factor();
                let pos = monitor.position();
                let size = monitor.size();
                let x = (pos.x as f64 / scale).round() as i32;
                let y = (pos.y as f64 / scale).round() as i32;
                let width = (size.width as f64 / scale).round() as u32;
                let height = (size.height as f64 / scale).round() as u32;
                let _ = window.set_position(tauri::LogicalPosition::new(x, y));
                let _ = window.set_size(tauri::LogicalSize::new(width, height));
            }

            // 기본적으로 클릭 통과 활성화 (다른 앱 클릭 방해 없음)
            window
                .set_ignore_cursor_events(true)
                .expect("Failed to set ignore cursor events");
            CLICK_THROUGH.store(true, Ordering::SeqCst);
            let _ = window.set_always_on_top(true);
            let _ = window.show();

            // 시스템 트레이 메뉴 설정
            let quit = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let mode_auto = MenuItem::with_id(app, "mode_auto", "자동 모드", true, None::<&str>)?;
            let mode_on = MenuItem::with_id(app, "mode_on", "클릭 통과 ON", true, None::<&str>)?;
            let mode_off = MenuItem::with_id(app, "mode_off", "클릭 통과 OFF", true, None::<&str>)?;
            let show_window = MenuItem::with_id(app, "show_window", "창 표시", true, None::<&str>)?;
            let reset_window = MenuItem::with_id(app, "reset_window", "창 위치 초기화", true, None::<&str>)?;

            // 캐릭터 선택/추가 메뉴
            let char_stone = MenuItem::with_id(app, "char_stone_guardian", "🗿 스톤 가디언으로 변경", true, None::<&str>)?;
            let char_iron = MenuItem::with_id(app, "char_iron_fist", "👊 철장 무승으로 변경", true, None::<&str>)?;
            let add_stone = MenuItem::with_id(app, "add_stone_guardian", "스톤 가디언 선택", true, None::<&str>)?;
            let add_iron = MenuItem::with_id(app, "add_iron_fist", "철장 무승 선택", true, None::<&str>)?;
            let remove_pet = MenuItem::with_id(app, "remove_last_pet", "➖ 마지막 펫 제거", true, None::<&str>)?;

            // 사이즈 조절 메뉴 (다양한 크기)
            let size_tiny = MenuItem::with_id(app, "size_tiny", "🔹 아주 작게 (20%)", true, None::<&str>)?;
            let size_small = MenuItem::with_id(app, "size_small", "🔹 작게 (40%)", true, None::<&str>)?;
            let size_normal = MenuItem::with_id(app, "size_normal", "🔸 보통 (80%)", true, None::<&str>)?;
            let size_large = MenuItem::with_id(app, "size_large", "🔶 크게 (150%)", true, None::<&str>)?;
            let size_huge = MenuItem::with_id(app, "size_huge", "🔶 아주 크게 (250%)", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[
                &char_stone,
                &char_iron,
                &add_stone,
                &add_iron,
                &remove_pet,
                &size_tiny,
                &size_small,
                &size_normal,
                &size_large,
                &size_huge,
                &mode_auto,
                &mode_on,
                &mode_off,
                &show_window,
                &reset_window,
                &quit
            ])?;

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
                    "show_window" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                            let _ = win.set_always_on_top(true);
                        }
                    }
                    "reset_window" => {
                        if let Some(win) = app.get_webview_window("main") {
                            if let Ok(Some(monitor)) = win.primary_monitor() {
                                let scale = monitor.scale_factor();
                                let pos = monitor.position();
                                let size = monitor.size();
                                let x = (pos.x as f64 / scale).round() as i32;
                                let y = (pos.y as f64 / scale).round() as i32;
                                let width = (size.width as f64 / scale).round() as u32;
                                let height = (size.height as f64 / scale).round() as u32;
                                let _ = win.set_position(tauri::LogicalPosition::new(x, y));
                                let _ = win.set_size(tauri::LogicalSize::new(width, height));
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                    }
                    "size_tiny" => {
                        let _ = app.emit("pet_scale_changed", 0.2_f64);
                    }
                    "size_small" => {
                        let _ = app.emit("pet_scale_changed", 0.4_f64);
                    }
                    "size_normal" => {
                        let _ = app.emit("pet_scale_changed", 0.8_f64);
                    }
                    "size_large" => {
                        let _ = app.emit("pet_scale_changed", 1.5_f64);
                    }
                    "size_huge" => {
                        let _ = app.emit("pet_scale_changed", 2.5_f64);
                    }
                    "char_stone_guardian" => {
                        let _ = app.emit("pet_character_changed", "stone-guardian");
                    }
                    "char_iron_fist" => {
                        let _ = app.emit("pet_character_changed", "iron-fist-master");
                    }
                    "add_stone_guardian" => {
                        let _ = app.emit("pet_add", "stone-guardian");
                    }
                    "add_iron_fist" => {
                        let _ = app.emit("pet_add", "iron-fist-master");
                    }
                    "remove_last_pet" => {
                        let _ = app.emit("pet_remove_last", ());
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
