from flask import Flask, request, jsonify
import requests
app = Flask(__name__)

def receive_location():
    data = request.get_json()
    name = data.get("name")
    latitude = data.get("latitude")
    longitude = data.get("longitude")

    print(f"Received location: {name}, Latitude: {latitude}, Longitude: {longitude}")

    arduino_ip = "http://arduino_ip_address"  # Replace with Arduino's actual IP

    if name == "Arcot Road":
        instruction = "start"
    else:
        instruction = "stop"

    payload = {"instruction": instruction}
    response = requests.post(f"{arduino_ip}/instruction", json=payload)

    if response.status_code == 200:
        return jsonify({"instruction": instruction})
    else:
        return jsonify({"instruction": "error", "message": "Failed to send instruction to Arduino"})

if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=5000)
