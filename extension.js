/*
  AirPods Battery Status extension for GNOME Shell 45
  Needs helper Python script to be installed as a systemd service
*/

import GLib from "gi://GLib";
import Clutter from "gi://Clutter";
import St from "gi://St";
import Gio from "gi://Gio";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

let outputFilepath = "/tmp/airstatus.out";
let cacheTTL = 3600;
const TIME_THRESHOLD = 0.25 * 60 * 1000;
const CONTAINER_WIDTH = 65;
const CONTAINER_WIDTH_LARGE = 75;
const CONTAINER_WIDTH_SMALL = 55;
const CONTAINER_WIDTH_ICON = 35;
const ICON_X = 22;
const ICON_X_SMALL = 6;
const AVERAGE_LABEL_X = 24;

class AirPodsBatteryStatus extends Extension {
  constructor(extensionMeta) {
    super(extensionMeta);
    this._outputFilePath = outputFilepath;
    this._outputValues = {};
    this._timer = null;
    this._lastValidUpdateTime = null;
    this._lastValidFileTime = null;
    this._cache = {
      leftUpdatedAt: null,
      rightUpdatedAt: null,
      caseUpdatedAt: null,
      modelUpdatedAt: null,
      leftChargingUpdatedAt: null,
      rightChargingUpdatedAt: null,
      caseChargingUpdatedAt: null,
    };
    this._panelMenuButton = null;
    this._container = null;
    this._leftAirpodLabel = null;
    this._rightAirpodLabel = null;
    this._averageAirpodLabel = null;
    this._icon = null;
    this._caseLabel = null;
    this._caseIcon = null;
    this._subMenuModelItem = null;
    this._subMenuModelItemLabel = null;
    this._subMenuLeftChargingItem = null;
    this._subMenuRightChargingItem = null;
    this._subMenuCaseChargingItem = null;
    this.buildLayout();
    this.updateUI();
  }

  getOutputValues() {
    if (typeof this._outputFilePath !== "string") {
      throw new Error("Invalid status file path: " + this._outputFilePath);
    }
    if (!GLib.file_test(this._outputFilePath, GLib.FileTest.EXISTS)) {
      Main.notifyError(
        "AirPods Battery Status",
        "The output file does not exist or isn't accessible. Make sure the helper Python script is installed and running."
      );
      throw new Error(
        "The output file does not exist or isn't accessible. Make sure the helper Python script is installed and running. Check this extension's website for instructions."
      );
    }

    let fileContents = GLib.file_get_contents(this._outputFilePath)[1];
    if (fileContents instanceof Uint8Array) {
      const decoder = new TextDecoder("utf-8");
      fileContents = decoder.decode(fileContents);
    } else {
      fileContents = fileContents.toString();
    }

    let lines = fileContents.trim().split("\n");
    let lastLine = lines[lines.length - 1];

    try {
      return lastLine.length > 0 ? JSON.parse(lastLine) : {};
    } catch (e) {
      throw new Error(
        "Failed to parse the output file: " +
          this._outputFilePath +
          " Error: " +
          e.message
      );
    }
  }

  formatDate(dateString) {
    let formatted = "Last Update Is Unknown";
    if (dateString) {
      let date = new Date(dateString);
      let dateOptions = { year: "numeric", month: "short", day: "numeric" };
      let timeOptions = { hour: "2-digit", minute: "2-digit" };
      let formattedDate = date.toLocaleDateString(undefined, dateOptions);
      let formattedTime = date.toLocaleTimeString(undefined, timeOptions);
      formatted = formattedDate + "\n" + formattedTime;
    }
    return formatted;
  }

  getAverage(sum, count) {
    return sum / count;
  }

  capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  getBatteryIcon(percentage, item) {
    if (percentage < 0) {
      return "battery-missing";
    }
    let level = Math.floor(percentage / 10) * 10;
    level = Math.min(level, 100);
    let iconName = `battery-level-${level}`;
    return iconName + (item ? "-charging" : "") + "-symbolic";
  }

  updateBatteryIcon(item, chargeItems, chargeStatus) {
    if (chargeItems.hasOwnProperty(item) && chargeItems[item] !== -1) {
      let iconName = this.getBatteryIcon(chargeItems[item], chargeStatus);
      this["_subMenu" + this.capitalize(item) + "ChargingItem"].setIcon(
        iconName
      );
    }
  }

  // update...Status functions show/hide elements and update their labels

  updateEarbudStatus(earbud, chargeItems, statusDate) {
    if (chargeItems.hasOwnProperty(earbud)) {
      if (chargeItems[earbud] !== -1) {
        this["_subMenu" + this.capitalize(earbud) + "ChargingItem"].label.text =
          this.capitalize(earbud) + ": " + chargeItems[earbud] + "%";
        this.updateBatteryIcon(
          earbud,
          chargeItems,
          this._outputValues["charging_" + earbud]
        );
        this["_subMenu" + this.capitalize(earbud) + "ChargingItem"].show();
        this._cache[earbud + "UpdatedAt"] = statusDate;
      } else {
        this["_subMenu" + this.capitalize(earbud) + "ChargingItem"].hide();
      }
    } else {
      this["_subMenu" + this.capitalize(earbud) + "ChargingItem"].hide();
    }
  }

  updateCaseStatus(chargeItems) {
    if (chargeItems.hasOwnProperty("case")) {
      if (chargeItems.case !== -1) {
        this["_subMenuCaseChargingItem"].label.text =
          "Case: " + chargeItems.case + "%";
        this.updateBatteryIcon(
          "case",
          chargeItems,
          this._outputValues["charging_case"]
        );
        this["_subMenuCaseChargingItem"].show();
      } else {
        this["_subMenuCaseChargingItem"].hide();
      }
    } else {
      this["_subMenuCaseChargingItem"].hide();
    }
  }

  updateModelInfo() {
    if (this._outputValues.status === -1) {
      this._subMenuModelItem.label.set_text("No Bluetooth");
    } else if (this._outputValues.status === 1) {
      this._subMenuModelItem.label.set_text(this._outputValues.model);
    } else {
      this._subMenuModelItem.label.set_text("No AirPods Detected");
    }
  }

  // topbar... functions update the topbar elements based on the charge percentage,
  // show/hide the average label, and manage animations for the icon and average label

  topbarUpdateValidData(sum, count) {
    if (count > 0) {
      let average = this.getAverage(sum, count);
      if (average > 99) {
        this._container.set_width(CONTAINER_WIDTH_LARGE);
        logMessage("Setting container width to large. Average is: " + average);
      } else if (average < 10) {
        this._container.set_width(CONTAINER_WIDTH_SMALL);
        logMessage("Setting container width to small. Average is: " + average);
      } else {
        this._container.set_width(CONTAINER_WIDTH);
        logMessage("Setting container width to normal. Average is: " + average);
      }
      if (!isNaN(average)) {
        if (!this._averageAirpodLabel.visible) {
          this._lastValidUpdateTime = Date.now();
          this._lastUpdateMenuItem.show();
          this._icon.x = ICON_X_SMALL + 30;
          this._icon.ease({
            x: 0,
            duration: 800,
            mode: Clutter.AnimationMode.ELASTIC,
          });
          this._averageAirpodLabel.show();
          this._averageAirpodLabel.x = AVERAGE_LABEL_X;
          this._averageAirpodLabel.ease({
            opacity: 255,
            duration: 400,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
          });
        }
        this._averageAirpodLabel.set_text(average.toFixed(0) + "%");
      }
    }
  }

  topbarUpdateStaleData() {
    if (this._averageAirpodLabel.visible) {
      this._container.set_width(CONTAINER_WIDTH);
      this._averageAirpodLabel.x = AVERAGE_LABEL_X - 30;
      this._averageAirpodLabel.ease({
        opacity: 0,
        duration: 400,
        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        onComplete: () => {
          this._averageAirpodLabel.hide();
        },
      });
      this._icon.x = ICON_X_SMALL - 30;
      this._icon.ease({
        x: ICON_X_SMALL,
        duration: 800,
        mode: Clutter.AnimationMode.ELASTIC,
      });
      this._container.set_width(CONTAINER_WIDTH_ICON);
    }
    this._subMenuLeftChargingItem.hide();
    this._subMenuRightChargingItem.hide();
    this._subMenuCaseChargingItem.hide();
  }

  // Check if the output is expired based on the cache limit date.
  isOutputExpired(statusDate) {
    let now = Date.now();
    let cacheLimitDate = now - cacheTTL * 1000;
    return statusDate < cacheLimitDate;
  }

  // Check recency based on the user set threshold
  isDataRecent() {
    return (
      this._lastValidFileTime &&
      Date.now() - this._lastValidFileTime <= TIME_THRESHOLD
    );
  }

  isValidCharge(charge, chargeable) {
    return charge.hasOwnProperty(chargeable) && charge[chargeable] !== -1;
  }

  updateUI() {
    this._outputValues = this.getOutputValues();
    let sum = 0;
    let count = 0;
    let lastUpdated = this.formatDate(this._outputValues.date);
    this._lastUpdateMenuItem.label.set_text(lastUpdated);
    let chargeItems = this._outputValues.hasOwnProperty("charge")
      ? this._outputValues.charge
      : {};
    let statusDate = this._outputValues.hasOwnProperty("date")
      ? Date.parse(this._outputValues.date)
      : null;
    if (this._outputValues.status === 1) {
      this._lastValidFileTime = Date.now();
    }
    if (!this.isOutputExpired(statusDate)) {
      ["left", "right"].forEach((item) => {
        this.updateEarbudStatus(item, chargeItems);
        if (this.isValidCharge(chargeItems, item)) {
          sum += chargeItems[item];
          count++;
        }
      });
      this.updateCaseStatus(chargeItems);
      this.updateModelInfo();
      if (this.isDataRecent()) {
        this.topbarUpdateValidData(sum, count);
      } else {
        this.topbarUpdateStaleData();
      }
    }
    return true;
  }

  // For topbar and menu
  buildLayout() {
    this._container = new St.Widget();
    this._leftAirpodLabel = new St.Label({
      text: "...",
      y_align: Clutter.ActorAlign.CENTER,
      style_class: "left-airpod-label",
    });
    this._icon = new St.Icon({
      gicon: Gio.icon_new_for_string(
        this.path.toString() + "/icons/airpods-symbolic.svg"
      ),
      y_align: Clutter.ActorAlign.CENTER,
      style_class: "airpods-pro-icon",
      width: 24,
      height: 24,
      y: 4,
    });
    this._averageAirpodLabel = new St.Label({
      text: "...",
      y_align: Clutter.ActorAlign.CENTER,
      style_class: "average-airpod-label",
      y: 6,
      x: AVERAGE_LABEL_X,
      opacity: 0,
    });
    this._averageAirpodLabel.hide();
    this._rightAirpodLabel = new St.Label({
      text: "...",
      y_align: Clutter.ActorAlign.CENTER,
      style_class: "right-airpod-label",
    });
    this._caseIcon = new St.Icon({
      gicon: Gio.icon_new_for_string(this.path.toString() + "/case.svg"),
      style_class: "system-status-icon",
      x: ICON_X,
    });
    this._caseLabel = new St.Label({
      text: "...",
      y_align: Clutter.ActorAlign.CENTER,
      style_class: "right-airpod-label",
    });
    this._lastUpdateMenuItem = new PopupMenu.PopupMenuItem(
      "Last Update Is Unknown"
    );
    this._lastUpdateMenuItem.actor.add_style_class_name(
      "sub-menu-item-no-icon"
    );
    this._container.add_actor(this._icon);
    this._container.add_actor(this._averageAirpodLabel);
    if (this._averageAirpodLabel.visible) {
      this._container.set_width(CONTAINER_WIDTH);
      this._averageAirpodLabel.set_x(AVERAGE_LABEL_X);
    } else {
      this._container.set_width(CONTAINER_WIDTH_ICON);
      this._icon.set_x(ICON_X_SMALL);
    }
    this._panelMenuButton = new PanelMenu.Button(
      0.5,
      "AirPodsBatteryStatusPopup",
      false
    );
    this._panelMenuButton.add_child(this._container);
    this._subMenuModelItem = new PopupMenu.PopupMenuItem("No AirPods Detected");
    this._subMenuModelItem.actor.add_style_class_name("sub-menu-item-no-icon");
    this._subMenuCaseChargingItem = new PopupMenu.PopupImageMenuItem(
      "...",
      "battery-missing"
    );
    this._subMenuLeftChargingItem = new PopupMenu.PopupImageMenuItem(
      "...",
      "battery-missing"
    );
    this._subMenuRightChargingItem = new PopupMenu.PopupImageMenuItem(
      "...",
      "battery-missing"
    );
    this._panelMenuButton.menu.addMenuItem(this._subMenuModelItem);
    this._panelMenuButton.menu.addMenuItem(this._subMenuCaseChargingItem);
    this._panelMenuButton.menu.addMenuItem(this._subMenuLeftChargingItem);
    this._panelMenuButton.menu.addMenuItem(this._subMenuRightChargingItem);
    this._panelMenuButton.menu.addMenuItem(this._lastUpdateMenuItem);
    Main.panel.addToStatusArea(
      "AirPodsBatteryStatus",
      this._panelMenuButton,
      1
    );
    this._subMenuLeftChargingItem.hide();
    this._subMenuRightChargingItem.hide();
    this._subMenuCaseChargingItem.hide();
  }

  enable() {
    logMessage("Extension enabled");
    this.updateUI();
    this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
      this.updateUI();
      return GLib.SOURCE_CONTINUE;
    });
  }

  disable() {
    logMessage("Extension disabled");
    this._panelMenuButton.destroy();
    Main.panel.statusArea["AirPodsBatteryStatus"] = null;
    if (this._timer) {
      GLib.source_remove(this._timer);
      this._timer = null;
    }
  }
}

export default class AirPodsBatteryStatusExtension {
  constructor(extensionMeta) {
    this.extensionInstance = null;
    this.extensionMeta = extensionMeta;
  }

  enable() {
    if (!this.extensionInstance) {
      this.extensionInstance = new AirPodsBatteryStatus(this.extensionMeta);
      this.extensionInstance.enable();
    }
  }

  disable() {
    if (this.extensionInstance) {
      this.extensionInstance.disable();
      Main.panel.statusArea["AirPodsBatteryStatus"] = null;
      this.extensionInstance = null;
    }
  }
}

let logMessage = (message) => {
  log(`[AirPodsBatteryStatus] ${message}`);
};
