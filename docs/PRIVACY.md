# OpenBot Privacy Policy

Last updated: 2023-08-23<br> The current OpenBot host is **Charleson Shuart**
(2023-2024)

<b>Developed by Living ArtsEngine members like you, OpenBot takes your privacy
seriously.</b> This policy outlines the exact kinds of data stored by OpenBot,
how you can retrieve your data, and how you can prevent your data from being
collected.

# Data Collection

To facilitate collaborative development, OpenBot features are organized into
modules, where different contributors may take responsibility for different
modules. Each module's data collection is described in a section below.

## `censorship` data

**The `censorship` module does not store any user data.** When prohibited words
are detected in a message, that message is automatically deleted, and a direct
message is sent to a moderator regarding that message in case it may pose a
safety concern. To protect LAE members from false-positive DPSS reports, you
cannot opt out of censorship.

## `classLookup` data

**The `classLookup` module does not store any user data.** All class lookup
results are produced on-demand, and class lookup queries are not recorded.

## `quotes` data

Each quote is a piece of text uttered or sent by a Living ArtsEngine member. For
each quote entered into OpenBot using `/add-quote` or the "Quote" context menu
action, the following is stored:

- The speaker of the quote, including their username in the LAE server and their
  Discord user ID
- The spoken or typed text of the quote

Each conversation is a sequence of stored quotes. The following is stored for
each conversation:

- The date on which the conversation was created
- A list of references to each quote in the conversation

Quote collection is **opt-in**, and all quotes are **public to the entire LAE
server**. By using `/add-quote` or the "Quote" context menu action, you
authorize OpenBot to collect this information. **To delete quotes or retrieve a
list of all quotes and conversations, contact the current OpenBot host.**

## `scheduleRecord` data

This module stores your academic schedule, which consists of a collection of
enrollments. For each enrollment, the following information is stored:

- The Discord user ID and LAE server nickname of the user that enrolls in a
  class
- The code for the enrolled course, like `UARTS 150`
- The section number of the enrolled course section
- The academic term in which the user was/is enrolled, like `Fall 2024`

Schedule recording is **opt-in**, and all schedules are **selectively shared**.
By entering an enrollment into OpenBot, you authorize it to inform other LAE
members who have entered an enrollment for the same class during the same term
or a later term about your enrollment. This is designed to facilitate academic
peer discovery.

For example, if you tell OpenBot that you took UARTS 150 in Fall 2022, OpenBot
will tell other UARTS 150 students in and after Fall 2022 (who have recorded
their enrollment with OpenBot as such) that you took it in Fall 2022.

In addition, your preference regarding whether you should be notified via direct
messages when you have a new academic peer is stored as either Yes or No.

**To permanently delete all your enrollments for a particular term, use
`/schedule-clear`. To retrieve your full schedule for a particular term, use
`/schedule`.**

# Data Security

All the recorded information above is stored on a [SQLite](https://sqlite.org)
database on a physical hard drive in a secured Bursley dorm room. The hard
drive's contents are only directly accessible by the current OpenBot host.
Please direct all data security-related questions to them.

For questions and concerns, please contact the current OpenBot host.
