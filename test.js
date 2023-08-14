const { exec } = require("child_process")

exec("cd backend/users && python make_question_schedules.py", (error, stdout, stderr) => { console.log(error, stdout, stderr) })