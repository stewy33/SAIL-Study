const fs = require("fs")
const yaml = require("js-yaml")
const nodemailer = require("nodemailer")

let transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
      type: 'OAuth2',
      user: 'slocumstewy@gmail.com',
      clientId: process.env.GOOGLE_OAUTH_CLIENTID,
      clientSecret: process.env.GOOGLE_OAUTH_SECRET,
      refreshToken: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
  }
});

// async..await is not allowed in global scope, must use a wrapper
const sendEmailReminder = async (email, minutesLeft, test) => {
  const hours = Math.floor(minutesLeft / 60)
  const minutes = minutesLeft % 60
  const timeleft = []
  if (hours > 0) timeleft.push(`${hours} hours`)
  if (minutes > 0) timeleft.push(`${minutes} minutes`)

  const messageOptions = {
    from: "\"Stewart Slocum\" <slocumstewy@gmail.com>",
    to: email,
    subject: `SAIL Study - Reminder to Complete Today's ${test ? "Test" : "Study Questions"}`,
    text: `
Hello SAIL study participant,

Just a reminder ${test ? `to finish your ${test}` : "that you have questions left to complete for today's study plan"} at https://sailstudyapp.com/ :)
${test ? "Your" : "Today's"} time ends in ${timeleft.join(" and ")}.

- The SAIL Team`
  }

  try {
  let info = await transporter.sendMail(messageOptions)
  console.log(`Reminder sent to ${email}`)
} catch(err) {
    console.log(err)
  }
}

const isMinutesBeforeFinishTime = (startTimeString, minutesBefore) => {
  const shouldFinishTime = new Date(startTimeString)
  shouldFinishTime.setDate(shouldFinishTime.getDate() + 1)

  const diffMinutes = Math.floor((shouldFinishTime - new Date()) / (1000 * 60))
  if (
    diffMinutes == minutesBefore ||
    diffMinutes % (24 * 60) === -24 * 60 + minutesBefore
  ) {
    return true
  }
}

const shouldSendUserReminder = (userData) => {
  const minutesBefore = [
    8 * 60,
    4 * 60,
    2 * 60,
    30,
  ]

  /* COMMENT THIS IF STATEMENT OUT DURING PRODUCTION
  if (userData.email !== "slocumstewy@gmail.com") {
    return { shouldSendRminder: false, minutesLeft: null }
  }
  -------------------------- */

  // Check if should send a reminder about pretest
  if (
    userData.times &&
    userData.times.pretest &&
    userData.times.pretest.start
  ) {
    if (
      !userData.times.pretest.finish &&
      minutesBefore.some((mins) =>
        isMinutesBeforeFinishTime(userData.times.pretest.start, mins)
      )
    ) {
      return { shouldSendReminder: true, test: "pre-test", minutesLeft: minutesBefore.find((mins) =>
          isMinutesBeforeFinishTime(userData.times.pretest.start, mins)) }
    }
  }

  // Check if should send a reminder about daily study questions
  if (userData.times && userData.times.studyTimes) {
    for (const day of userData.times.studyTimes) {
      if (
        !day.finish &&
        minutesBefore.some((mins) =>
          isMinutesBeforeFinishTime(day.allowedStart, mins)
        )
      ) {
        return { shouldSendReminder: true, minutesLeft: minutesBefore.find((mins) =>
          isMinutesBeforeFinishTime(day.allowedStart, mins)) }
      }
    }
  }

  // Check if should send a reminder about posttest
  if (userData.times && userData.times.posttest) {
    if (
      !userData.times.posttest.finish &&
      minutesBefore.some((mins) =>
        isMinutesBeforeFinishTime(userData.times.posttest.allowedStart, mins)
      )
    ) {
      const posttest_type = userData.second_posttest ? "2 month follow-up post-test" :
                            userData.first_posttest ? "1 week follow-up post-test" :
                            "post-test"
      return { shouldSendReminder: true, test: posttest_type, minutesLeft: minutesBefore.find((mins) =>
          isMinutesBeforeFinishTime(userData.times.posttest.allowedStart, mins)) }
    }
  }
    
  return { shouldSendReminder: false, minutesLeft: null }
}

const checkAndSendReminders = () => {
  return // don't send emails anymore (Jul 25, 2023)

  for (const userFile of fs.readdirSync("backend/users")) {
    // Skip random files and demo user file
    if (!userFile.includes(".yaml") || userFile === "demo.yaml") {
      continue
    }
    const userData = yaml.safeLoad(fs.readFileSync(`backend/users/${userFile}`))
    const { shouldSendReminder, minutesLeft, test } = shouldSendUserReminder(userData)
    if (shouldSendReminder) {
      console.log(`${new Date()} - sending email reminder to ${userData.email}`)
      sendEmailReminder(userData.email, minutesLeft, test)
    }
  }
}

const startEmailReminderService = () => setInterval(checkAndSendReminders, 60000)


if (require.main == module) {
  checkAndSendReminders()
}


module.exports = startEmailReminderService
