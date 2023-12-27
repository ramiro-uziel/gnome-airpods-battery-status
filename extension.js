import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import GLib from "gi://GLib";
import Clutter from "gi://Clutter";
import St from "gi://St";
import Gio from "gi://Gio";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
const ByteArray = imports.byteArray;

let statusFilePath = "/tmp/airstatus.out";
let cacheTTL = 3600;

class AipodsBatteryStatus extends Extension {
  constructor(extensionMeta) {
    super(extensionMeta);
    this._statusFilePath = statusFilePath;
    this._panelMenuButton = null;
    this._timer = null;
    this._currentStatusValue = {};
    this._cache = {
      leftUpdatedAt: null,
      rightUpdatedAt: null,
      caseUpdatedAt: null,
      modelUpdatedAt: null,
      leftChargingUpdatedAt: null,
      rightChargingUpdatedAt: null,
      caseChargingUpdatedAt: null,
    };

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

    this.updateBatteryStatus();
  }

  getCurrentStatus() {
    Log("getCurrentStatus");
    if (typeof this._statusFilePath !== "string") {
      console.error("Invalid status file path:", this._statusFilePath);
      return {};
    }

    if (!GLib.file_test(this._statusFilePath, GLib.FileTest.EXISTS)) {
      return {};
    }
    let fileContents = GLib.file_get_contents(this._statusFilePath)[1];

    let lines;
    if (fileContents instanceof Uint8Array) {
      lines = ByteArray.toString(fileContents).trim().split("\n");
    } else {
      lines = fileContents.toString().trim().split("\n");
    }

    let lastLine = lines[lines.length - 1];

    return lastLine.length > 0 ? JSON.parse(lastLine) : {};
  }

  updateBatteryStatus() {
    Log("updateBatteryStatus");

    this._currentStatusValue = this.getCurrentStatus();

    let sum = 0;
    let count = 0;

    let lastUpdated = "Unknown";
    if (this._currentStatusValue.hasOwnProperty("date")) {
      let dateTimeParts = this._currentStatusValue.date.split(" ");
      if (dateTimeParts.length > 1) {
        lastUpdated = dateTimeParts[1];
      }
    }

    this._lastUpdateMenuItem.label.set_text("Last updated: " + lastUpdated);

    let charge = this._currentStatusValue.hasOwnProperty("charge")
      ? this._currentStatusValue.charge
      : {};
    let statusDate = this._currentStatusValue.hasOwnProperty("date")
      ? Date.parse(this._currentStatusValue.date)
      : null;
    let now = Date.now();
    let cacheLimitDate = now - cacheTTL * 1000;
    let statusTooOld = statusDate < cacheLimitDate;

    ["left", "right"].forEach((chargeable) => {
      if (
        !statusTooOld &&
        charge.hasOwnProperty(chargeable) &&
        charge[chargeable] !== -1
      ) {
        sum += charge[chargeable];
        count++;
        this["_" + chargeable + "AirpodLabel"].set_text(
          charge[chargeable] + " %"
        );
        this._cache[chargeable + "UpdatedAt"] = statusDate;
      } else if (
        this._cache[chargeable + "UpdatedAt"] === null ||
        this._cache[chargeable + "UpdatedAt"] < cacheLimitDate
      ) {
        this["_" + chargeable + "AirpodLabel"].set_text("...");
      }
    });

    if (!statusTooOld && charge.hasOwnProperty("case")) {
      if (charge.case !== -1) {
        this._subMenuCaseChargingItem.label.text = "Case: " + charge.case + "%";
        this._subMenuCaseChargingItem.show();
      } else {
        this._caseLabel.hide();
        this._caseIcon.hide();
        this._subMenuCaseChargingItem.hide();
      }
    } else if (
      statusTooOld ||
      this._cache.caseUpdatedAt === null ||
      this._cache.caseUpdatedAt < cacheLimitDate
    ) {
      this._subMenuCaseChargingItem.hide();
    }

    if (!statusTooOld && this._currentStatusValue.hasOwnProperty("model")) {
      if (this._currentStatusValue.model === "Unknown model") {
        this._subMenuModelItem.label.set_text("Not connected");
      } else {
        this._subMenuModelItem.label.set_text(this._currentStatusValue.model);
      }
    } else if (
      statusTooOld ||
      this._cache.modelUpdatedAt === null ||
      this._cache.modelUpdatedAt < cacheLimitDate
    ) {
      this._subMenuModelItem.label.set_text("No AirPods detected");
    }

    let average = count > 0 ? sum / count : 0;

    if (this.areAllMenuItemsHidden()) {
      this._averageAirpodLabel.hide();
      // this.adjustLayoutForHiddenElements();
    } else {
      this._averageAirpodLabel.show();
    }

    if (average > 0) {
      this._averageAirpodLabel.set_text(average.toFixed(0) + " %");
    }

    ["case", "left", "right"].forEach((chargeable) => {
      if (
        !statusTooOld &&
        charge.hasOwnProperty(chargeable) &&
        charge[chargeable] !== -1
      ) {
        if (chargeable === "case") {
          this[
            "_subMenu" + this.capitalize(chargeable) + "ChargingItem"
          ].show();
          this._caseLabel.set_text("Case: " + charge[chargeable] + "%");
          this[
            "_subMenu" + this.capitalize(chargeable) + "ChargingItem"
          ].setIcon(
            this.getBatteryIcon(
              charge[chargeable],
              this._currentStatusValue["charging_" + chargeable]
            )
          );
        } else {
          this[
            "_subMenu" + this.capitalize(chargeable) + "ChargingItem"
          ].show();
          this[
            "_subMenu" + this.capitalize(chargeable) + "ChargingItem"
          ].label.text =
            this.capitalize(chargeable) + ": " + charge[chargeable] + "%";
          this[
            "_subMenu" + this.capitalize(chargeable) + "ChargingItem"
          ].setIcon(
            this.getBatteryIcon(
              charge[chargeable],
              this._currentStatusValue["charging_" + chargeable]
            )
          );
        }
      } else {
        if (chargeable === "case") {
          this._caseLabel.set_text("Case: N/A");
        } else {
          this[
            "_subMenu" + this.capitalize(chargeable) + "ChargingItem"
          ].hide();
        }
      }
    });

    return true;
  }

  buildLayout() {
    Log("buildLayout");

    let box = new St.BoxLayout();

    this._leftAirpodLabel = new St.Label({
      text: "...",
      y_align: Clutter.ActorAlign.CENTER,
      style_class: "left-airpod-label",
    });

    this._icon = new St.Icon({
      gicon: Gio.icon_new_for_string(this.path.toString() + "/airpods.svg"),
      y_align: Clutter.ActorAlign.CENTER,
      style_class: "airpods-pro-icon",
      width: 24,
      height: 24,
    });

    this._averageAirpodLabel = new St.Label({
      text: "...",
      y_align: Clutter.ActorAlign.CENTER,
      style_class: "average-airpod-label",
    });

    this._rightAirpodLabel = new St.Label({
      text: "...",
      y_align: Clutter.ActorAlign.CENTER,
      style_class: "right-airpod-label",
    });

    this._caseIcon = new St.Icon({
      gicon: Gio.icon_new_for_string(this.path.toString() + "/case.svg"),
      style_class: "system-status-icon",
    });

    this._caseLabel = new St.Label({
      text: "...",
      y_align: Clutter.ActorAlign.CENTER,
      style_class: "right-airpod-label",
    });

    this._lastUpdateMenuItem = new PopupMenu.PopupMenuItem("Last updated: ...");
    this._lastUpdateMenuItem.actor.add_style_class_name(
      "sub-menu-item-no-icon"
    );

    box.add(this._icon);
    box.add(this._averageAirpodLabel);
    //box.add(this._leftAirpodLabel);
    //box.add(this._rightAirpodLabel);
    //box.add(this._caseIcon);
    //box.add(this._caseLabel);

    this._panelMenuButton = new PanelMenu.Button(
      0.5,
      "AirpodsBatteryStatusPopup",
      false
    );
    this._panelMenuButton.add_child(box);
    this._subMenuModelItem = new PopupMenu.PopupMenuItem("No AirPods detected");
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
      "AirpodsBatteryStatus",
      this._panelMenuButton,
      1
    );
  }

  getBatteryIcon(percentage, charging) {
    let iconName = "battery-";
    switch (true) {
      case percentage < 0:
        return "battery-missing";
      case percentage <= 10:
        iconName += "level-10";
        break;
      case percentage <= 40:
        iconName += "level-40";
        break;
      case percentage <= 70:
        iconName += "level-70";
        break;
      case percentage <= 100:
        iconName += "level-100";
        break;
      default:
        return "battery-missing";
    }

    return iconName + (charging ? "-charging" : "") + "-symbolic";
  }

  capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  areAllMenuItemsHidden() {
    return (
      !this._subMenuCaseChargingItem.visible &&
      !this._subMenuLeftChargingItem.visible &&
      !this._subMenuRightChargingItem.visible
    );
  }

  enable() {
    Log("enable");
    this.updateBatteryStatus();

    this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
      this.updateBatteryStatus();
      return GLib.SOURCE_CONTINUE;
    });
  }

  disable() {
    Log("disable");

    this._panelMenuButton.destroy();
    Main.panel.statusArea["AirpodsBatteryStatus"] = null;

    if (this._timer) {
      GLib.source_remove(this._timer);
      this._timer = null;
    }
  }
}

export default class AirpodsBatteryStatusExtension {
  constructor(extensionMeta) {
    this.batteryStatus = null;
    this.extensionMeta = extensionMeta;
  }

  enable() {
    if (!this.batteryStatus) {
      this.batteryStatus = new AipodsBatteryStatus(this.extensionMeta);
      this.batteryStatus.enable();
    }
  }

  disable() {
    if (this.batteryStatus) {
      this.batteryStatus.disable();
      Main.panel.statusArea["AirpodsBatteryStatus"] = null;
      this.batteryStatus = null;
    }
  }
}

let Log = function (msg) {
  log("[Airpods Battery Status] " + msg);
};
