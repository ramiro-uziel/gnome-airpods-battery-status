# AirPods Battery Status for GNOME 45

> [!CAUTION]
> 1. The borrowed python script is currently very unreliable and unstable (Outputs wrong battey values, has a Bluez related system crash). A better python/bluetooth implementation is needed.
> 2. I'm not very experienced with GJS. If you know proper GJS feel free to contribute. The extension is not tested extensively.
---

A GNOME Shell Extension to display the battery levels of your AirPods in the top bar.

<div align="center">
  
| ![https://github.com/ramiro-uziel/gnome-airpods-battery-status/blob/main/screenshot.png](https://github.com/ramiro-uziel/gnome-airpods-battery-status/blob/main/screenshot.png) | 
|:--:| 
| *Shows the average of the Pods' battery reads. Changed the icon to the AirPods Pro 2. I could add icon switching depending on the device.*|

| ![https://github.com/ramiro-uziel/gnome-airpods-battery-status/blob/main/screenshot2.png](https://github.com/ramiro-uziel/gnome-airpods-battery-status/blob/main/screenshot2.png) | 
|:--:| 
| *Popup menu with less stuff on it. Also displays the time from the last read.*|

</div>

## Requirements

Install [main.py](https://github.com/ramiro-uziel/gnome-airpods-battery-status/blob/main/main.py) script (from this repo) as a service, using `/tmp/airstatus.out` as output file.

I got it from [this repo (AirStatus)](https://github.com/delphiki/AirStatus).

## Installation

Do this:
```shell
$ mkdir -p ~/.local/share/gnome-shell/extensions/airpods-battery-status@dubstep.yeah
$ cd ~/.local/share/gnome-shell/extensions/airpods-battery-status@dubstep.yeah
$ git clone https://github.com/ramiro-uziel/gnome-airpods-battery-status .
```
## Changelog
- Updated for GNOME 45
- New dash icon
- The battery value in the dash is the average of both Pods' batteries
- Hides icons when the battery value is -1, and dash value when all values are -1 (when AirPods disconnect, loose power or just glitch out)
- Shows charging status with icons instead of text
- Shows the time of the last update

## To-do
- [ ] Reimplementation of AirStatus Python script
- [ ] Add timeout for certain values
- [ ] Add icon switching depending on model string
- [ ] Add settings menu

## Credit
[AirStatus](https://github.com/delphiki/AirStatus)

[Forks this](https://github.com/delphiki/gnome-airpods-battery-status)

