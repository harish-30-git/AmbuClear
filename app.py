from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db
import os
import base64
import json
from dotenv import load_dotenv
import threading

load_dotenv()

app = Flask(__name__)
CORS(app)

firebase_creds_b64 = os.getenv("FIREBASE_CONFIG_BASE64")
if not firebase_creds_b64:
    raise ValueError("Missing FIREBASE_CONFIG_BASE64 in .env")

decoded_creds = base64.b64decode(firebase_creds_b64).decode('utf-8')
firebase_creds = json.loads(decoded_creds)

cred = credentials.Certificate(firebase_creds)
firebase_admin.initialize_app(cred, {
    'databaseURL': os.getenv("FIREBASE_DB_URL")
})

queue = []
active_timers = {} 

TIMEOUT_DURATION = 9 * 60

def revert_to_stop(name, esp32_id):
    print(f"Timeout reached for {name}. Reverting status to 'stop'")
    try:
        if name in queue:
            queue.remove(name)
        ref = db.reference(f'/locations/{name}/{esp32_id}')
        ref.set({
            'status': 'stop'
        })
    except Exception as e:
        print(f"Error reverting status: {e}")

@app.route('/location', methods=['POST'])
def location():
    global queue, active_timers
    try:
        data = request.get_json(force=True)
        print(f"Received location data: {data}")
        print(queue)
        esp32_id = data.get('esp32_id')
        name = data.get('name')
        status = data.get('status')  

        if not all([esp32_id, name, status]):
            return jsonify({"status": "failure", "error": "Missing required fields"}), 400

        # Handle status
        if status == "start":
            if name not in queue:
                queue.append(name)
                

            # Cancel existing timer if any
            if name in active_timers:
                active_timers[name].cancel()

            # Start a new timer
            timer = threading.Timer(TIMEOUT_DURATION, revert_to_stop, args=(name, esp32_id))
            timer.start()
            active_timers[name] = timer

        elif status == "stop":
            if name in queue:
                queue.remove(name)

            # Cancel the timer
            if name in active_timers:
                active_timers[name].cancel()
                del active_timers[name]

        # Update Firebase
        ref = db.reference(f'/locations/{name}/{esp32_id}')
        ref.set({
            'status': status
        })

        return jsonify({
            "status": "success",
            "esp32_id": esp32_id,
            "name": name,
            "status": status
        })

    except Exception as e:
        return jsonify({"status": "failure", "error": str(e)}), 500
@app.route('/queue', methods=['GET'])
def get_queue():
    return jsonify({
        "status": "success",
        "queue": queue
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
