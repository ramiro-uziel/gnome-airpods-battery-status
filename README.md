# AirPods Battery Status for GNOME 45

> [!NOTE]
> This fork is my attempt to port this extension to Gnome Shell 45. I also added some tweaks. Keep in mind I have not made anything with GNOME's JavaScript implementation before this. It kind of works but it isn't consistent (because of the python script mostly). If you know proper ESM feel free to look at it, laugh, and then help please.
>
> Also take a look at the python script. I haven't edited much except just renaming the model output for the JSON parsing in the extension. Sometimes it doesn't recognize the device and outputs wrong data. I had to add a lot of workarounds in the extension so it didn't feel as broken. A better python/bluetooth implementation is needed.

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

I got it from [this repo (AirStatus)](https://github.com/delphiki/AirStatus)

## Installation

> [!WARNING]
> Not on https://extensions.gnome.org/

Do this:
```shell
$ mkdir -p ~/.local/share/gnome-shell/extensions/airpods-battery-status@dubstep.yeah
$ cd ~/.local/share/gnome-shell/extensions/airpods-battery-status@dubstep.yeah
$ git clone https://github.com/ramiro-uziel/gnome-airpods-battery-status .
```
## Changelog
- Works with GNOME 45
- New dash icon
- The battery value in the dash is the average of both Pods' batteries
- Hides icons when the battery value is -1, and dash value when all values are -1 (when AirPods disconnect, loose power or just glitch out)
- Shows charging status with icons instead of text
- Shows the time of the last update

## To-do
- [x] Hide dash value with timeout instead of -1 battery value.
- [ ] Add timeout for regular values
- [ ] Add icon switching depending on model string.
- [ ] Fix python script not recognizing the headphones sometimes.
- [ ] Add settings menu.

## Credit
[AirStatus](https://github.com/delphiki/AirStatus)

[Forks this](https://github.com/delphiki/gnome-airpods-battery-status)

