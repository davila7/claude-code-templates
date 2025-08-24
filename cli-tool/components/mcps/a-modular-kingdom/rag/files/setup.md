**Please run `python voice_commander_simple.py` to start the program.**

# Portable Voice Commander for Windows

This project provides a high-performance, system-wide voice-to-text utility for Windows. Press a hotkey (`F9`) to start recording your voice, press it again to stop, and the transcribed text will be instantly pasted at your cursor's location.

It is designed to be fast, portable, and run silently in the background without a GUI.

## Requirements
- An NVIDIA GPU for high-speed transcription.
- The Python programming language.
- The `sounddevice`, `scipy`, `pynput`, and `pyperclip` Python packages.

## Setup

1.  **Install Python Dependencies:** Open a command prompt and run the following command:
    ```bash
    pip install sounddevice scipy pynput pyperclip
    ```

2.  **Configure Your Microphone (First-Time Only):**
    - Run the `run_voice_commander.bat` file once.
    - A list of your available microphones will be printed with an ID number next to each.
    - Find your preferred microphone in the list and note its ID.
    - Open `voice_commander_simple.py` in a text editor.
    - At the top of the file, change `MIC_DEVICE_ID = None` to `MIC_DEVICE_ID = YOUR_ID` (e.g., `MIC_DEVICE_ID = 2`).
    - Save the file.

## Usage

Simply double-click `run_voice_commander.bat` to start the application. A command window will appear and listen for your hotkey.

- Press `F9` to start recording.
- Speak your phrase.
- Press `F9` again to stop recording and paste the transcribed text.

To close the application, simply close the command window.
