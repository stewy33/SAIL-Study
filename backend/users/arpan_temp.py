## Not being used in application
## Just a script to look at who has completed the study

import glob
import yaml
import csv

counter = 1

names = []
emails = []

emailDict = {}
with open('participants.csv', newline='\n') as csvfile:
    reader = csv.reader(csvfile, delimiter=',')
    for row in reader:
        emailDict[row[1]] = row[2]

for filename in glob.glob("*.yaml"):
  with open(filename, 'r') as file:
    userdata = yaml.safe_load(file)
    times = None
    try:
      times = userdata['times']
    except:
      continue

    if "second_posttest" in times and "finish" in times["second_posttest"]:
      if "finish" in times["posttest"]: # done with 3rd post-test
        emails.append(userdata['email'])
        names.append(emailDict[userdata['email']])
        print(counter, userdata['email'], " done with everything")
        counter += 1
      else: # will start 3rd post-test
        print(userdata['email'], emailDict[userdata['email']], f"done with 2nd post-test, starting final test on {times['posttest']['allowedStart']}")
    elif "first_posttest" in times and "finish" in times["first_posttest"]: # will start 2nd post-test
      print(userdata['email'], emailDict[userdata['email']], f"done with 1st post-test, starting 2nd test on {times['posttest']['allowedStart']}")
    elif "posttest" in times: # will start 1st post-test
      print(userdata['email'], emailDict[userdata['email']], f"done with study, starting 1st test on {times['posttest']['allowedStart']}")
# print("\n".join(emails))
# print("\n".join(names))