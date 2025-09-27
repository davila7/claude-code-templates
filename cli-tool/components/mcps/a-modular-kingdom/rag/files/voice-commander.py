import os
import threading
import time
import pyperclip
from pynput import keyboard
import sounddevice as sd
import numpy as np
import subprocess
import tempfile
import uuid
import re
from scipy.io.wavfile import write as write_wav

# Use CUDA-enabled whisper.cpp for GPU acceleration
MIC_DEVICE_ID = 2 
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# CUDA-enabled whisper.cpp build  
WHISPER_CPP_DIR = os.path.join(SCRIPT_DIR, "whisper.cpp-binaries-windows-x64-cublas-12.6.0-1.6.2-20241002")
WHISPER_EXECUTABLE = os.path.join(WHISPER_CPP_DIR, "main.exe")
WHISPER_MODEL_PATH = os.path.join(SCRIPT_DIR, "ggml-medium.en.bin")

HOTKEY = keyboard.Key.f9
SAMPLE_RATE = 16000
CHANNELS = 1

# Set environment for potential GPU usage
os.environ['CUDA_VISIBLE_DEVICES'] = '0'
os.environ['PATH'] = f"{os.environ['PATH']};C:\\Program Files\\NVIDIA GPU Computing Toolkit\\CUDA\\v12.9\\bin"

def list_audio_devices():
    print("--------------------------------------------------")
    print("Available Audio Input Devices:")
    print("--------------------------------------------------")
    try:
        devices = sd.query_devices()
        input_devices = [d for d in devices if d['max_input_channels'] > 0]
        if not input_devices:
            print("No input devices found.")
            return
        for i, device in enumerate(input_devices):
            device_id = devices.index(device)
            print(f"  ID {device_id}: {device['name']}")
    except Exception as e:
        print(f"Could not list audio devices: {e}")
    print("--------------------------------------------------\n")

list_audio_devices()

if MIC_DEVICE_ID is not None:
    try:
        sd.check_input_settings(device=MIC_DEVICE_ID)
        print(f"Using specified audio device ID: {MIC_DEVICE_ID}")
    except Exception as e:
        print(f"FATAL: Invalid audio device ID '{MIC_DEVICE_ID}'. Error: {e}")
        exit()

if not os.path.exists(WHISPER_EXECUTABLE):
    print(f"FATAL: Whisper executable not found at {WHISPER_EXECUTABLE}")
    print("Building CPU version first...")
    # Build CPU-only version
    os.chdir(os.path.join(SCRIPT_DIR, "whisper.cpp"))
    if not os.path.exists("build"):
        os.makedirs("build")
    os.chdir("build")
    subprocess.run([
        "C:/Program Files (x86)/Microsoft Visual Studio/2022/BuildTools/Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe", 
        "..", "-DCMAKE_BUILD_TYPE=Release"
    ])
    subprocess.run([
        "C:/Program Files (x86)/Microsoft Visual Studio/2022/BuildTools/Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe", 
        "--build", ".", "--config", "Release"
    ])

if not os.path.exists(WHISPER_MODEL_PATH):
    print(f"FATAL: Whisper model not found at {WHISPER_MODEL_PATH}")
    exit()

class SimpleRecorder:
    def __init__(self):
        self.recording = False
        self.lock = threading.Lock()
        self.audio_data = []

    def toggle_recording(self):
        with self.lock:
            if self.recording:
                self.recording = False
                print(">>> Recording stopping...")
            else:
                if not any(thread.name == 'RecorderThread' for thread in threading.enumerate()):
                    self.recording = True
                    print(">>> Recording started. Press F9 to stop...")
                    self.audio_data = []
                    thread = threading.Thread(target=self._record_and_process, name='RecorderThread', daemon=True)
                    thread.start()

    def _record_and_process(self):
        self._record_audio()
        with self.lock:
            self.recording = False
        if self.audio_data:
            concatenated_data = np.concatenate(self.audio_data, axis=0)
            self._transcribe_and_paste(concatenated_data)
        else:
            print("No audio recorded.")

    def _record_audio(self):
        def callback(indata, frame_count, time_info, status):
            if status:
                print(status)
            if self.recording:
                self.audio_data.append(indata.copy())
            else:
                raise sd.CallbackStop

        try:
            with sd.InputStream(
                device=MIC_DEVICE_ID,
                samplerate=SAMPLE_RATE, 
                channels=CHANNELS, 
                dtype='float32', 
                callback=callback
            ):
                while self.recording:
                    sd.sleep(100)
        except Exception as e:
            print(f"Error during recording stream: {e}")

    def _transcribe_and_paste(self, audio_data):
        temp_dir = tempfile.gettempdir()
        temp_audio_name = f"voice_command_{uuid.uuid4().hex[:8]}.wav"
        temp_audio_path = os.path.join(temp_dir, temp_audio_name)
        
        output_txt_path = ""
        try:
            print(f"Saving audio to {temp_audio_path}...")
            write_wav(temp_audio_path, SAMPLE_RATE, (audio_data * 32767).astype(np.int16))
            
            print("Transcribing with whisper.cpp...")
            # Use CUDA GPU acceleration with Linux-optimized command structure
            command = [
                WHISPER_EXECUTABLE,
                "-m", WHISPER_MODEL_PATH,
                "-f", temp_audio_path,
                "-nt"
            ]
            
            start_time = time.time()
            result = subprocess.run(
                command, 
                capture_output=True, 
                text=True, 
                cwd=os.path.dirname(WHISPER_EXECUTABLE)
            )
            end_time = time.time()

            print(f"Transcription took {end_time - start_time:.2f} seconds")
            print(f"Return code: {result.returncode}")
            
            if result.returncode != 0:
                print("--- WHISPER.CPP ERROR ---")
                print(result.stderr)
                print("-------------------------")
            
            output_txt_path = f"{temp_audio_path}.txt"
            transcribed_text = ""
            
            time.sleep(0.2)

            if os.path.exists(output_txt_path):
                with open(output_txt_path, 'r', encoding='utf-8') as f:
                    transcribed_text = f.read().strip()
                print(f"Transcribed: {transcribed_text}")
            elif result.stdout.strip():
                transcribed_text = result.stdout.strip()
                print(f"Transcribed (from stdout): {transcribed_text}")
            else:
                print("Transcription output file not found.")

            # Remove noise artifacts like [wind], [blank audio], etc.
            if transcribed_text:
                transcribed_text = re.sub(r'\[.*?\]', '', transcribed_text).strip()

            if transcribed_text:
                pyperclip.copy(transcribed_text)
                print("Text copied to clipboard. Pasting...")

                controller = keyboard.Controller()
                time.sleep(0.1) 
                with controller.pressed(keyboard.Key.ctrl):
                    controller.press('v')
                    controller.release('v')
                print("Paste command sent.")
            else:
                print("No speech detected.")

        except Exception as e:
            print(f"Transcription or paste error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            if os.path.exists(temp_audio_path):
                os.remove(temp_audio_path)
            if output_txt_path and os.path.exists(output_txt_path):
                os.remove(output_txt_path)

recorder = SimpleRecorder()

def on_press(key):
    if key == HOTKEY:
        recorder.toggle_recording()

def main():
    print(f"Voice Commander is active. Press '{HOTKEY}' to start/stop recording.")
    print("Using CUDA GPU acceleration.")
    print("Close this window or press Ctrl+C to exit.")
    print("\nListening for F9 key...")

    with keyboard.Listener(on_press=on_press) as listener:
        listener.join()

if __name__ == "__main__":
    main()