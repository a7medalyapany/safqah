use std::{
    collections::VecDeque,
    fs,
    path::PathBuf,
    process::Command,
    sync::{
        atomic::{AtomicU32, Ordering},
        Arc, Mutex,
    },
    time::{Instant, SystemTime, UNIX_EPOCH},
};

use tauri::{AppHandle, Emitter};

use crate::errors::AppError;

static NEXT_PRINT_JOB_ID: AtomicU32 = AtomicU32::new(1);

#[derive(Debug, Clone)]
pub struct PrintPayload {
    pub bytes: Vec<u8>,
    pub printer_name: Option<String>,
    pub invoice_id: i64,
}

#[derive(Debug, Clone)]
pub struct PrintJob {
    pub id: u32,
    pub payload: PrintPayload,
    pub attempts: u8,
    pub created_at: Instant,
}

pub type PrintQueue = Arc<Mutex<VecDeque<PrintJob>>>;

pub fn new_print_queue() -> PrintQueue {
    Arc::new(Mutex::new(VecDeque::new()))
}

pub fn enqueue_print_job(queue: &PrintQueue, payload: PrintPayload) -> Result<u32, AppError> {
    let id = NEXT_PRINT_JOB_ID.fetch_add(1, Ordering::Relaxed);
    let job = PrintJob {
        id,
        payload,
        attempts: 0,
        created_at: Instant::now(),
    };

    let mut jobs = queue.lock().map_err(|_| {
        AppError::new(
            "PRINT_QUEUE_LOCK",
            "تعذر حفظ مهمة الطباعة لإعادة المحاولة",
            "Failed to lock print queue",
        )
    })?;
    jobs.push_back(job);
    Ok(id)
}

pub fn start_print_queue_worker(queue: PrintQueue, app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(2));

        loop {
            interval.tick().await;

            let job = match queue.lock() {
                Ok(jobs) => jobs.front().cloned(),
                Err(error) => {
                    eprintln!("failed to lock print queue: {error}");
                    None
                }
            };

            let Some(job) = job else {
                continue;
            };

            match send_print_payload(&job.payload) {
                Ok(()) => {
                    if let Ok(mut jobs) = queue.lock() {
                        if matches!(jobs.front(), Some(front) if front.id == job.id) {
                            jobs.pop_front();
                        }
                    }
                }
                Err(error) => {
                    eprintln!(
                        "print job {} for invoice {} failed after {:?}: {}",
                        job.id,
                        job.payload.invoice_id,
                        job.created_at.elapsed(),
                        error.message_en
                    );

                    let mut failed_payload = None;
                    if let Ok(mut jobs) = queue.lock() {
                        if let Some(front) = jobs.front_mut() {
                            if front.id == job.id {
                                front.attempts = front.attempts.saturating_add(1);
                                if front.attempts >= 3 {
                                    failed_payload = jobs.pop_front().map(|dropped| dropped.payload);
                                }
                            }
                        }
                    }

                    if let Some(payload) = failed_payload {
                        let _ = app_handle.emit("print_failed", payload.invoice_id);
                    }
                }
            }
        }
    });
}

pub fn send_print_payload(payload: &PrintPayload) -> Result<(), AppError> {
    send_raw_to_printer(&payload.bytes, payload.printer_name.as_deref())
}

fn send_raw_to_printer(bytes: &[u8], printer_name: Option<&str>) -> Result<(), AppError> {
    #[cfg(target_os = "windows")]
    {
        send_raw_to_windows_printer(bytes, printer_name)
    }

    #[cfg(not(target_os = "windows"))]
    {
        send_raw_to_unix_printer(bytes, printer_name)
    }
}

#[cfg(target_os = "windows")]
fn send_raw_to_windows_printer(bytes: &[u8], printer_name: Option<&str>) -> Result<(), AppError> {
    let printer_name = printer_name.ok_or_else(|| {
        AppError::new(
            "PRINTER_NAME_REQUIRED",
            "اسم الطابعة مطلوب للطباعة على ويندوز",
            "Printer name is required on Windows",
        )
    })?;
    let path = write_temp_print_file(bytes)?;
    let script = r#"
$printerName = [Console]::In.ReadLine()
$path = [Console]::In.ReadLine()
$signature = @'
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }

  [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
  [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

  public static bool SendBytes(string printerName, byte[] bytes) {
    IntPtr hPrinter;
    if (!OpenPrinter(printerName.Normalize(), out hPrinter, IntPtr.Zero)) return false;
    DOCINFOA di = new DOCINFOA();
    di.pDocName = "Safqah Receipt";
    di.pDataType = "RAW";
    bool ok = StartDocPrinter(hPrinter, 1, di);
    if (ok) ok = StartPagePrinter(hPrinter);
    if (ok) {
      IntPtr unmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
      Marshal.Copy(bytes, 0, unmanagedBytes, bytes.Length);
      int written;
      ok = WritePrinter(hPrinter, unmanagedBytes, bytes.Length, out written);
      Marshal.FreeCoTaskMem(unmanagedBytes);
      ok = ok && written == bytes.Length;
    }
    EndPagePrinter(hPrinter);
    EndDocPrinter(hPrinter);
    ClosePrinter(hPrinter);
    return ok;
  }
}
'@
Add-Type -TypeDefinition $signature
$bytes = [System.IO.File]::ReadAllBytes($path)
if (-not [RawPrinterHelper]::SendBytes($printerName, $bytes)) {
  exit 1
}
"#;

    let mut child = Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script])
        .stdin(std::process::Stdio::piped())
        .spawn()
        .map_err(print_io_error)?;

    if let Some(stdin) = child.stdin.as_mut() {
        use std::io::Write;
        writeln!(stdin, "{printer_name}").map_err(print_io_error)?;
        writeln!(stdin, "{}", path.display()).map_err(print_io_error)?;
    }

    let status = child.wait().map_err(print_io_error)?;
    let _ = fs::remove_file(&path);

    if status.success() {
        Ok(())
    } else {
        Err(print_failed_error("Windows raw printer command failed"))
    }
}

#[cfg(not(target_os = "windows"))]
fn send_raw_to_unix_printer(bytes: &[u8], printer_name: Option<&str>) -> Result<(), AppError> {
    let path = write_temp_print_file(bytes)?;
    let mut command = Command::new("lp");
    command.arg("-o").arg("raw");
    if let Some(printer_name) = printer_name {
        command.arg("-d").arg(printer_name);
    }
    command.arg(&path);

    let output = command.output().map_err(print_io_error)?;
    let _ = fs::remove_file(&path);

    if output.status.success() {
        Ok(())
    } else {
        Err(print_failed_error(&String::from_utf8_lossy(&output.stderr)))
    }
}

fn write_temp_print_file(bytes: &[u8]) -> Result<PathBuf, AppError> {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| print_failed_error(&error.to_string()))?
        .as_nanos();
    let path = std::env::temp_dir().join(format!(
        "safqah-receipt-{}-{nanos}.bin",
        std::process::id()
    ));
    fs::write(&path, bytes).map_err(print_io_error)?;
    Ok(path)
}

fn print_io_error(error: std::io::Error) -> AppError {
    print_failed_error(&error.to_string())
}

fn print_failed_error(message: &str) -> AppError {
    AppError::new(
        "PRINT_FAILED",
        "فشلت الطباعة — تأكد من اتصال الطابعة",
        &format!("Print failed: {message}"),
    )
}
