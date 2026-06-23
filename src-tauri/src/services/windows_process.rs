#[cfg(target_os = "windows")]
pub fn no_window_command(program: &str) -> std::process::Command {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let mut command = std::process::Command::new(program);
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

// #[cfg(not(target_os = "windows"))]
// pub fn no_window_command(program: &str) -> std::process::Command {
//     std::process::Command::new(program)
// }
