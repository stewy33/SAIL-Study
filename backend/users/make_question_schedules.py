"""
Script to generate random question schedules for users during the study
that are approximately balanced in difficulty between modalities.

"""
import copy
import glob

import numpy as np
import pandas as pd
import scipy.stats
import tqdm
import yaml


def generate_question_assignment(correct_answers, difficulties, pretest):
    modalities = ["voice", "voiceless", "mc"]

    qs_per_modality = {}
    best_pvalue = 0
    for _ in range(1000):
        # Split questions into 3 modalities equally based on how many were
        # correct/incorrect during pretest.
        np.random.shuffle(pretest)
        correct_pretest = np.array_split(
            [q for q in pretest if q["response"] == correct_answers[q["QID"]]], 3
        )
        incorrect_pretest = np.array_split(
            [q for q in pretest if q["response"] != correct_answers[q["QID"]]], 3
        )
        qs_per_modality_prime = {
            modalities[i]: np.concatenate([correct_pretest[i], incorrect_pretest[i]])
            for i in range(len(modalities))
        }

        # Keep randomizing until difficulties of each modalities are approximately
        # equal as measured by percent responders who got it right on Orthobullets.
        modality_difficulties = [
            [difficulties[q["QID"]] for q in qs]
            for qs in qs_per_modality_prime.values()
        ]
        """pvalue = min(
            scipy.stats.ks_2samp(
                modality_difficulties[i], modality_difficulties[j]
            ).pvalue
            for i, j in [[0, 1], [0, 2], [1, 2]]
        )"""
        pvalue = scipy.stats.kruskal(*modality_difficulties).pvalue
        if pvalue > best_pvalue:
            qs_per_modality = qs_per_modality_prime
            best_pvalue = pvalue
        if best_pvalue >= 0.05:
            break

    # Study takes place over two 5 day periods. We want to randomly assign a
    # modality to each question so that we get roughly equal quantity of
    # assignments, and so that all questions of a particular modality are asked
    # together on the same day (less switching between qs of different modalities).
    for m in qs_per_modality:
        np.random.shuffle(qs_per_modality[m])
        qs_per_modality[m] = np.array_split(qs_per_modality[m], 5)

    questions_by_day = []
    for day in range(5):
        days_qs = []
        np.random.shuffle(modalities)
        for m in modalities:
            days_qs.extend(
                [{"qid": str(q["QID"]), "modality": m} for q in qs_per_modality[m][day]]
            )
        questions_by_day.append(days_qs)

    # Repeat study plan for future days
    questions_by_day.extend(copy.deepcopy(questions_by_day))
    return questions_by_day


def main():
    # Read in all questions and their difficulties
    correct_answers = {}
    for fname in glob.glob("../../questions/topics/*/questions.yaml"):
        if "Demo" not in fname:
            with open(fname) as f:
                questions = yaml.safe_load(f)
            correct_answers.update(
                {q["Id"]: q["MultipleChoice"]["Correct"] for q in questions}
            )

    difficulties_df = pd.read_csv("../../questions/question_difficulties.csv")
    difficulties = dict(
        zip(difficulties_df["Id"], difficulties_df["Percent who answered correctly"])
    )

    # Read and write all user profiles except "demo.yaml" and those
    # with question schedules already or who haven't done pretest.
    for fname in tqdm.tqdm(glob.glob("*.yaml")):
        if fname != "demo.yaml":
            with open(fname) as f:
                data_dict = yaml.safe_load(f)

            if (
                data_dict["status"] == "pretestDone"
                and "questionSchedule" not in data_dict
                # for debugging - will rewrite questionSchedule always: "pretest" in data_dict
            ):
                data_dict["questionSchedule"] = generate_question_assignment(
                    correct_answers, difficulties, data_dict["pretest"]
                )

                with open(fname, "w") as f:
                    yaml.dump(data_dict, f)


if __name__ == "__main__":
    main()
