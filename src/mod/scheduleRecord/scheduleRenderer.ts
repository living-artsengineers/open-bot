import { Bitmap } from "pureimage/types/bitmap";
import * as PImage from "pureimage";
import { Course, Meeting, Section, Weekday } from "../../soc/entities";
import { Duration } from "luxon";
import * as fs from "fs";
import { join } from "path";
import { zeroPad } from "../../utils";

const config = {
  // Width of the entire image shown to the user.
  imageWidth: 900,
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
  sectionFontFamily: "Iosevka Curly",
  marginFontFamily: "Iosevka Curly Slab",
  // Colors for distinguishing courses (in RGB)
  courseColors: [
    [91, 88, 143],
    [66, 134, 33],
    [106, 39, 134],
    [115, 123, 85],
    [42, 43, 240],
    [169, 104, 28],
    [215, 37, 163],
    [36, 128, 161],
  ],
  marginFontSize: 18,
  sectionFontSize: 16,
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

PImage.registerFont(
  join("fonts", "iosevka-term-curly-regular.ttf"),
  "Iosevka Curly",
  400,
  "normal",
  "normal"
).loadSync();
PImage.registerFont(
  join("fonts", "iosevka-term-curly-slab-regular.ttf"),
  "Iosevka Curly Slab",
  400,
  "normal",
  "normal"
).loadSync();
PImage.registerFont(join("fonts", "ComicNeue-Bold.ttf"), "Comic Neue", 600, "normal", "normal").loadSync();

export class ScheduleRenderer {
  readonly canvas: Bitmap;
  readonly hoursVisible: number;
  readonly sectionFontFamily: string;
  readonly marginFontFamily: string;

  constructor(private readonly sections: [Section<true>, Course][]) {
    this.hoursVisible = totalHours(this.latestTimeShown()) - totalHours(this.earliestTimeShown());
    this.canvas = PImage.make(
      config.imageWidth,
      config.heightPerHour * this.hoursVisible + 2 * config.tablePadding + config.dayLabelHeight,
      {}
    );
    const funny = Math.random() < 0.1;
    this.sectionFontFamily = funny ? "Comic Neue" : config.sectionFontFamily;
    this.marginFontFamily = funny ? "Comic Neue" : config.marginFontFamily;
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
    ctx.font = `${config.marginFontSize}px ${this.marginFontFamily}`;

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
    const uniqueCourses = Array.from(new Set(this.sections.map((x) => x[1].toString())));
    for (const [section, course] of this.sections) {
      for (const meeting of section.meetings) {
        this.renderMeeting(course, uniqueCourses.indexOf(course.toString()), section, meeting);
      }
    }
  }

  private renderMeeting(course: Course, colorIndex: number, section: Section<true>, meeting: Meeting<true>) {
    const ctx = this.canvas.getContext("2d");
    function rgba(rgb: number[], a: number) {
      return `rgba(${rgb.join(",")},${a})`;
    }
    const bgFillStyle = rgba(
      config.courseColors[(colorIndex + config.courseColors.length) % config.courseColors.length],
      0.7
    );
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

        ctx.fillStyle = bgFillStyle;
        ctx.fillRect(
          leftX + config.textPadding,
          topY + config.textPadding,
          width - 2 * config.textPadding,
          height - 2 * config.textPadding
        );
        ctx.fillStyle = config.style.text;
        ctx.font = `${config.sectionFontSize}px ${this.sectionFontFamily}`;
        const label = [
          `${course.toString()} ${section.type}`,
          `Section ${zeroPad(section.number)}`,
          `${meeting.location ?? ""}`,
        ];
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        label.forEach((line, i) => {
          ctx.fillText(
            line,
            leftX + config.textPadding * 2,
            topY + config.textPadding * 2 + i * config.marginFontSize * 1.1
          );
        });
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
    // Discard the minute value for flooring
    return Duration.fromObject({ hour: earliest.hours });
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
    // Ceiling function to next hour
    return latest.minutes > 0 ? Duration.fromObject({ hour: latest.hours + 1 }) : latest;
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
