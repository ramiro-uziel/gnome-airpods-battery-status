# Airpods Battery Status


    This fork is my attempt to port this extension to Gnome Shell 45. Keep in mind I did this over one night without sleeping. Most of it is janky and bad, but it kind of works. Please don't expect it to work consistently. If you know proper ESM please modify this lmao.

---

A Gnome Shell Extension to display the battery levels of your Airpods (and case) in the top bar.

![Airpods Battery Status](https://github.com/delphiki/gnome-airpods-battery-status/raw/main/screenshot.png)

## Requirements

Install [AirStatus](https://github.com/delphiki/AirStatus) as a service, using `/tmp/airstatus.out` as output file.

## Installation

Search for "Airpods battery status" on https://extensions.gnome.org/

OR 

```shell
$ mkdir -p ~/.local/share/gnome-shell/extensions/airpods-battery-status@ju.wtf
$ cd ~/.local/share/gnome-shell/extensions/airpods-battery-status@ju.wtf
$ git clone https://github.com/delphiki/gnome-airpods-battery-status .
```
