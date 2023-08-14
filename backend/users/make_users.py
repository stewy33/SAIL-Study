"""
Script to fill out user database from `participants.csv`, which holds the
results of the SAIL Study Registration Google Form.

"""
import os

import pandas as pd
import yaml


def main():
    # Open .csv with user info and empty .yaml user profiles
    df = pd.read_csv("participants.csv", comment="#")
    df = df.append({"Username": "demo"}, ignore_index=True)

    for _, row in df.iterrows():
        email = row["Username"].lower()
        data_dict = {
            "email": email,
            "status": "notStarted",
            "completed": {"days": 0, "questions": 0},
        }
        if email == "demo":
            data_dict.update({"pretest": "demo"})

        if not os.path.exists(f"{email}.yaml"):
            with open(f"{email}.yaml", "w") as f:
                yaml.dump(data_dict, f)


if __name__ == "__main__":
    main()
