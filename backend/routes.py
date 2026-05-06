from flask import Blueprint, request, jsonify
from services.summarize import summarize_text

routes = Blueprint("routes", __name__)

@routes.route("/summarize", methods=["POST"])
def summarize():

    data = request.json

    text = data.get("text")

    if not text:
        return jsonify({
            "error": "No transcript found"
        }), 400

    result = summarize_text(text)

    return jsonify({
        "summary": result
    })