import glob
from textblob import TextBlob
import yaml


def main():
    all_words = []
    for folder in glob.glob("../questions/topics/*"):
        with open(f"{folder}/questions.yaml") as f:
            questions = yaml.safe_load(f)

            for q in questions:
                all_words.extend(
                    [q["MultipleChoice"]["Correct"]]
                    + q["MultipleChoice"]["Incorrect"]
                    + q.get("CorrectAnswers", [])
                    + q.get("IncorrectAnswers", [])
                )

    all_words = TextBlob(" ".join(all_words).lower())
    with open("speech_adaptation_dictionary.yaml") as f:
        dictionary = yaml.safe_load(f)

    speech_adaptation_vocab = [
        w.string
        for w in all_words.words
        if w not in dictionary["common_english_words_1000"]
    ]
    dictionary["speech_adaptation_vocab"] = list(set(speech_adaptation_vocab))

    with open("speech_adaptation_dictionary.yaml", "w") as f:
        yaml.dump(dictionary, f)


if __name__ == "__main__":
    main()
