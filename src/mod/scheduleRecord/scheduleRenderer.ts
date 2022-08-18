import { Bitmap } from "pureimage/types/bitmap";
import * as PImage from "pureimage";
import { Course, Meeting, Section, Weekday } from "../../soc/entities";
import { Duration } from "luxon";
import * as fs from "fs";
import { join } from "path";

const config = {
  // Width of the entire image shown to the user.
  imageWidth: 600,
  // Each hour irl corresponds to this number of pixels high.
  heightPerHour: 80,
  // Width reserved for time labels (8 AM, 12 PM, etc.)
  timeLabelWidth: 60,
  // Height reserved for day labels (Mon, Tue, etc.)
  dayLabelHeight: 40,
  // Padding around the entire table
  tablePadding: 20,
  // Padding in each table cell, for text
  textPadding: 4,
  // Normal font for all labels
  fontFamily: "Source Sans 3",
  // Scale for all primitive drawings in order to make the final image sharper
  // canvasScale: 2,
  fontSize: 18,
  style: {
    background: "rgb(47,49,54)",
    borders: "rgb(120,120,120)",
    text: "rgb(220,220,220)",
  },
  weekdays: [Weekday.Monday, Weekday.Tuesday, Weekday.Wednesday, Weekday.Thursday, Weekday.Friday],

  get widthPerWeekday() {
    return (config.imageWidth - config.timeLabelWidth - 2 * config.tablePadding) / config.weekdays.length;
  },
};

PImage.registerFont(join("fonts", "SourceSans3-Regular.ttf"), "Source Sans 3", 400, "normal", "normal").loadSync();
PImage.registerFont("C:\\Windows\\Fonts\\comic.ttf", "Comic Sans MS", 400, "normal", "normal").loadSync();

export class ScheduleRenderer {
  readonly canvas: Bitmap;
  readonly hoursVisible: number;
  readonly fontFamily: string;

  constructor(private readonly sections: [Section<true>, Course][]) {
    this.hoursVisible = totalHours(this.latestTimeShown()) - totalHours(this.earliestTimeShown());
    this.canvas = PImage.make(
      config.imageWidth,
      config.heightPerHour * this.hoursVisible + 2 * config.tablePadding + config.dayLabelHeight,
      {}
    );
    this.fontFamily = Math.random() < 1 ? "Comic Sans MS" : config.fontFamily;
  }

  public async render(filename: string) {
    this.drawBackground();
    this.drawTableOutlineWithLabels();
    this.drawSections();
    await PImage.encodePNGToStream(this.canvas, fs.createWriteStream(filename));
  }

  private drawBackground() {
    const ctx = this.canvas.getContext("2d");
    ctx.fillStyle = config.style.background;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private drawTableOutlineWithLabels() {
    const ctx = this.canvas.getContext("2d");
    ctx.textBaseline = "middle";
    ctx.lineWidth = 2;
    ctx.font = `${config.fontSize}px ${this.fontFamily}`;

    // Vertical
    for (let i = 0; i < config.weekdays.length; i++) {
      const pathX = config.tablePadding + config.timeLabelWidth + config.widthPerWeekday * i;
      ctx.beginPath();
      ctx.moveTo(pathX, config.tablePadding);
      ctx.lineTo(pathX, this.canvas.height - config.tablePadding);
      ctx.strokeStyle = config.style.borders;
      ctx.stroke();

      ctx.fillStyle = config.style.text;
      ctx.fillText(config.weekdays[i], pathX + config.textPadding, config.tablePadding + config.dayLabelHeight / 2);
    }
    ctx.textBaseline = "top";
    // Horizontal; one between each consecutive pair of hours
    const earliestTime = this.earliestTimeShown();
    for (let i = 0; i < this.hoursVisible; i++) {
      const pathY = config.tablePadding + config.dayLabelHeight + config.heightPerHour * i;
      ctx.beginPath();
      ctx.moveTo(config.tablePadding, pathY);
      ctx.lineTo(this.canvas.width - config.tablePadding, pathY);
      ctx.strokeStyle = config.style.borders;
      ctx.stroke();

      ctx.fillStyle = config.style.text;
      ctx.fillText(formatHour(earliestTime.hours + i), config.tablePadding, pathY + config.textPadding);
    }
  }

  private drawSections() {
    for (const [section] of this.sections) {
      for (const meeting of section.meetings) {
        this.renderMeeting(meeting);
      }
    }
  }

  private renderMeeting(meeting: Meeting<true>) {
    const ctx = this.canvas.getContext("2d");
    if (meeting.startTime !== null && meeting.endTime !== null) {
      for (const day of meeting.days) {
        const leftX =
          config.tablePadding + config.timeLabelWidth + config.widthPerWeekday * config.weekdays.indexOf(day);
        const topY =
          (totalHours(meeting.startTime) - totalHours(this.earliestTimeShown())) * config.heightPerHour +
          config.tablePadding +
          config.dayLabelHeight;
        const height = (totalHours(meeting.endTime) - totalHours(meeting.startTime)) * config.heightPerHour;
        const width = config.widthPerWeekday;
        ctx.fillStyle = "#ff0000";
        ctx.fillRect(
          leftX + config.textPadding,
          topY + config.textPadding,
          width - 2 * config.textPadding,
          height - 2 * config.textPadding
        );
      }
    }
  }

  // TODO optimize (cache)
  // Pure utility functions
  private earliestTimeShown(): Duration {
    let earliest = Duration.fromObject({ hour: 9 });
    for (const [section] of this.sections) {
      for (const meeting of section.meetings) {
        if (meeting.startTime !== null && totalHours(meeting.startTime) < totalHours(earliest)) {
          earliest = meeting.startTime;
        }
      }
    }
    return earliest;
  }

  private latestTimeShown(): Duration {
    let latest = Duration.fromObject({ hour: 17 });
    for (const [section] of this.sections) {
      for (const meeting of section.meetings) {
        if (meeting.endTime !== null && totalHours(meeting.endTime) > totalHours(latest)) {
          latest = meeting.endTime;
        }
      }
    }
    return latest;
  }
}

function totalHours(dur: Duration): number {
  return dur.hours + dur.minutes / 60 + dur.seconds / 3600;
}

export function formatHour(hour: number): string {
  const baseHour = hour % 24;
  const am = baseHour < 12;
  const intShown = ((baseHour + 11) % 12) + 1;
  return `${intShown} ${am ? "AM" : "PM"}`;
}
