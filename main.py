import asyncio
import functools
import json
import time
import argparse
import sys
from collections import deque
from binascii import hexlify
from typing import Optional, Any
from datetime import datetime
from bleak import BleakScanner
import subprocess

MIN_RSSI = -80
AIRPODS_MANUFACTURER = 76
AIRPODS_DATA_LENGTH = 54
MAX_LINES = 10
FILE_NAME = "/tmp/airstatus.out"

def model_from_raw(raw: bytes) -> str:
    if chr(raw[7]) == 'e':
        return "AirPods Pro"
    elif chr(raw[7]) == '4':
        return "AirPods Pro 2"
    elif chr(raw[7]) == '3':
        return "AirPods 3"
    elif chr(raw[7]) == 'f':
        return "AirPods 2"
    elif chr(raw[7]) == '2':
        return "AirPods 1"
    elif chr(raw[7]) == 'a':
        return "AirPods Max"
    else:
        return None


def retry_on_none(*, times: int, sleep_ms: float):
    def decorator(f):
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            for _ in range(times):
                val = f(*args, **kwargs)

                if val is not None:
                    return val

                time.sleep(sleep_ms / 1000)
            return None

        return wrapper

    return decorator


@retry_on_none(times=5, sleep_ms=250)
async def fetch_airpods_raw_data() -> Optional[bytes]:
    devices = await BleakScanner.discover(return_adv=True)
    for _, d in devices.items():
        ad = d[1]
        data = ad.manufacturer_data.get(AIRPODS_MANUFACTURER, None)
        if data is None:
            continue
        is_valid_rssi = ad.rssi >= MIN_RSSI
        data_hex = hexlify(data)
        starts_not_with_12 = not (chr(data_hex[0]) == '1' and chr(data_hex[1]) == '2')
        is_correct_model = model_from_raw(data_hex) is not None
        is_correct_length = len(data_hex) == AIRPODS_DATA_LENGTH

        if is_valid_rssi and starts_not_with_12 and is_correct_model and is_correct_length:
            return data_hex

    return None

def parse_airpods_data(raw: bytes) -> dict:
    if not raw:
        return dict(status=0, model="AirPods not found")

    flip: bool = is_flipped(raw)
    
    model = model_from_raw(raw)
    if model is None:
        model = "Unknown Model"
    
    # Checking left AirPod for availability and storing charge in variable
    status_tmp = int("" + chr(raw[12 if flip else 13]), 16)
    left_status = (100 if status_tmp == 10 else (status_tmp * 10 + 5 if status_tmp <= 10 else -1))

    # Checking right AirPod for availability and storing charge in variable
    status_tmp = int("" + chr(raw[13 if flip else 12]), 16)
    right_status = (100 if status_tmp == 10 else (status_tmp * 10 + 5 if status_tmp <= 10 else -1))

    # Checking AirPods case for availability and storing charge in variable
    status_tmp = int("" + chr(raw[15]), 16)
    case_status = (100 if status_tmp == 10 else (status_tmp * 10 + 5 if status_tmp <= 10 else -1))

    # On 14th position we can get charge status of AirPods
    charging_status = int("" + chr(raw[14]), 16)
    charging_left:bool = (charging_status & (0b00000010 if flip else 0b00000001)) != 0
    charging_right:bool = (charging_status & (0b00000001 if flip else 0b00000010)) != 0
    charging_case:bool = (charging_status & 0b00000100) != 0

    # Return result info in dict format
    if model == "Unknown Model":
        return dict(
            status=0,
            model=model,
        )
    else:
        return dict(
            status=1,
            charge=dict(
                left=left_status,
                right=right_status,
                case=case_status
            ),
            charging_left=charging_left,
            charging_right=charging_right,
            charging_case=charging_case,
            model=model,
            date=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            raw=raw.decode("utf-8")
        )

# Return if left and right is flipped in the data
def is_flipped(raw):
    return (int("" + chr(raw[10]), 16) & 0x02) == 0

def is_bluetooth_adapter_powered_on(timeout_seconds=30):
    start_time = time.time()
    while time.time() - start_time < timeout_seconds:
        try:
            result = subprocess.run(["bluetoothctl", "show"], capture_output=True, text=True)
            if "Powered: yes" in result.stdout:
                return True
        except Exception as e:
            print(f"Error checking Bluetooth adapter status: {e}")
        time.sleep(1)
    return False

async def main(max_lines=MAX_LINES, output_to_terminal=False):
    output_lines = deque(maxlen=max_lines)
    file_exists = False

    try:
        with open(FILE_NAME, "r") as file:
            existing_lines = file.readlines()
            if existing_lines:
                file_exists = True
            for line in existing_lines[-max_lines:]:
                output_lines.append(line)
    except FileNotFoundError:
        pass 

    try:
        if not is_bluetooth_adapter_powered_on():
            print("Bluetooth adapter not ready. Exiting.")
            sys.exit(1)

        while True:
            try:
                raw_data = await fetch_airpods_raw_data()
                
            except Exception as e:
                print(f"[!] {e}" + '\n' + "Please ensure your Bluetooth adapter is powered on.")
                output = json.dumps(dict(
                            status=-1,
                            model="No Bluetooth Adapter",
                            date=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                            )
                        )
                with open(FILE_NAME, "w") as file:
                    file.writelines(output)
                sys.exit(1)
                
            if raw_data is None:
                output = json.dumps(dict(status=0, model="AirPods not found", date=datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
            else:
                output = json.dumps(parse_airpods_data(raw_data))

            if output_to_terminal:
                print(output)

            if file_exists:
                output_lines.append('\n' + output)
            else:
                output_lines.append(output)
                file_exists = True

            with open(FILE_NAME, "w") as file:
                file.writelines(output_lines)

            await asyncio.sleep(5)

    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", action="store_true",
                        help="Enable output to terminal")
    args = parser.parse_args()

    try:
        asyncio.run(main(MAX_LINES, args.output))
    except KeyboardInterrupt:
        print("[!] Interrupted by user.")