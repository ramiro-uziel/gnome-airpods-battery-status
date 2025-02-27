# AirPods Battery Status for GNOME 45
A GNOME Shell Extension to display the battery level of your AirPods in the top bar.

<div align="center">
  
![https://github.com/ramiro-uziel/gnome-airpods-battery-status/blob/main/screenshot.png](https://github.com/ramiro-uziel/gnome-airpods-battery-status/blob/main/images/screenshot.png)

*Shows the average of the Pods' battery reads.*

![https://github.com/ramiro-uziel/gnome-airpods-battery-status/blob/main/screenshot2.png](https://github.com/ramiro-uziel/gnome-airpods-battery-status/blob/main/images/screenshot2.png)

*Popup menu.*

https://github.com/ramiro-uziel/gnome-airpods-battery-status/assets/132919483/5363321e-009c-4fb7-adab-dd15e94ec421

*Connect and disconnect animations. Yes it's 4 am.*

</div>

## Features
- Shows average value of Pods' batteries
- Hides icons when the battery value is null, and dash value when all values are null. Has 3 minute timeout to hide them.
- Shows charging status with Adawita icons
- Shows the time of the last update
- Reimplementation of AirStatus Python script

Has support for
- AirPods 1
- AirPods 2
- AirPods 3
- AirPods Pro
- AirPods Pro 2
- AirPods Max

> [!WARNING]
> 1. The Python script used in this extension can misread info sometimes and can read other AirPods' battery info if used around many.
> 2. If you are using a laptop, keep in mind that the Python script may affect battery life.
> 3. The extension has not been tested extensively.
> 4. This is my first GNOME shell extension. If you know GJS and see something weird feel free to contribute.

## Installation

### GNOME Shell Extension

First clone the extension's repo by doing the following:
```shell
$ mkdir -p ~/.local/share/gnome-shell/extensions/airpods-battery-status@dubstep.yeah
$ cd ~/.local/share/gnome-shell/extensions/airpods-battery-status@dubstep.yeah
$ git clone https://github.com/ramiro-uziel/gnome-airpods-battery-status .
```
Don't enable the extension until you do the next step.

### Helper Python script

Install the python script (from this repo) as a service.

Create the file /etc/systemd/system/airstatus.service (as root) containing:
```
[Unit]
Description=AirPods Battery Monitor

[Service]
ExecStart=/usr/bin/python3 /PATH/TO/main.py
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
```

Then start the service:

```
sudo systemctl start airstatus
```

And finally enable the service on boot:
```
sudo systemctl enable airstatus
```

Restart the system and enable the extension.

## Changelog

- Updated for GNOME 45
- New dash icon
- The battery value in the dash is the average of both Pods' batteries
- Hides icons when the battery value is null, and dash value when all values are null (when AirPods disconnect, loose power or just glitch out). Has 30 second timeout.
- Shows charging status with icons instead of text
- Shows the time of the last update
- Reimplementation of AirStatus Python script

## To-do

- [ ] Add icon switching depending on model string
- [ ] Add settings menu

## Credit

This is a fork of [this gnome extension from delphiki](https://github.com/delphiki/gnome-airpods-battery-status).

The python script is a modified version of [this script by andirsun](https://github.com/andirsun/gnome-shell-extention-airpods-battery/blob/main/airpods_battery.py).

The python script is possible [thanks to this paper](https://arxiv.org/pdf/1904.10600.pdf). We know just enough about Apple's BLE protocol that we can extract the battery info from the raw data. 

