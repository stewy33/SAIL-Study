"""Main module which runs the flask server."""

import flask
import score

# Create flask app
app = flask.Flask(__name__)


@app.route("/score", methods=["POST"])
def score_response():
    request = flask.request.get_json(force=True)
    print(request)
    res = app.config["scorer"].score(request["question_id"], request["response"])
    return (str(res), 200)


@app.route("/")
def index(path=None):
    return (str("Hello"), 200)


def main():
    app.config["scorer"] = score.new_scorer()
    # app.run(host=None, debug=True, port=3001)
    from waitress import serve
    serve(app, port=3001)


if __name__ == "__main__":
    main()
