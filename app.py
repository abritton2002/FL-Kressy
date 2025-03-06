import os
from flask import Flask, request, render_template, session
from flask_session import Session

import pandas as pd
from sqlalchemy import create_engine
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
import numpy as np
import matplotlib.pyplot as plt
import math
import secrets
from datetime import timedelta
import logging
import threading
import time
from functools import lru_cache
import pitch_classify as pc

app = Flask(__name__, static_folder='static', static_url_path='/static')
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(minutes=30)  # Expire sessions after 30 minutes of inactivity
app.config['SESSION_TYPE'] = 'filesystem'
app.secret_key = secrets.token_hex(32)
Session(app)

@app.before_request
def make_session_permanent():
    session.permanent = True  # Makes the session last according to PERMANENT_SESSION_LIFETIME

@app.route('/', methods=['GET', 'POST'])
def home():
    if request.method == 'POST':        
        if "find" in request.form:
            session['form_data'] = {
                "pitch_hand": request.form.get("pitch_hand"),
                "velocity": float(request.form.get("velocity")),
                "spin_rate": float(request.form.get("spin_rate")),
                "trackman_h_break": float(request.form.get("horizontal_break")),
                "v_break": float(request.form.get("vertical_break")),
                "release_x_ft": float(request.form.get("release_x")),
                "release_z_ft": float(request.form.get("release_z")),
                "spin_efficiency": float(request.form.get("spin_efficiency")),
            }

            form_data = session['form_data']
            # Fetch pitch data based on session information
            df = pc.recommend_secondary_pitches(**form_data)
            
            if len(df) > 0:
                no_results=1
                session['recommendations'] = df.to_dict()
                session['target_variations'] = df['pitch_type_cons']
                return render_template('calculator.html', target_variations=session['target_variations'],  **form_data, no_results=0)
            else:
                return render_template('calculator.html',  **form_data, no_results=1)
        
        elif "show" in request.form:
            form_data = session['form_data']
            session['target_variation'] = request.form.get('target_variation')
            # Fetch pitch data based on session information
            df = pd.DataFrame(session.get('recommendations', []))
            new_df = df.loc[(df['pitch_type_cons'] == session['target_variation'])].reset_index(drop=True)
            new_df['avg_velocity'] = new_df['avg_velocity'].astype(float).round(2)
            new_df['avg_spin_rate'] = new_df['avg_spin_rate'].astype(float).round(2)
            new_df['avg_h_break'] = new_df['avg_h_break'].astype(float).round(2)
            new_df['avg_v_break'] = new_df['avg_v_break'].astype(float).round(2)
            new_df['avg_stuff_plus'] = new_df['avg_stuff_plus'].astype(float).round(2)
            new_df['avg_spin_efficiency'] = new_df['avg_spin_efficiency'].astype(float).round(2)
            new_df['avg_active_spin'] = new_df['avg_active_spin'].astype(float).round(2)
            new_df['omega_x'] = new_df['omega_x'].astype(float).round(2)
            new_df['omega_y'] = new_df['omega_y'].astype(float).round(2)
            new_df['omega_z'] = new_df['omega_z'].astype(float).round(2)
            new_df['spin_axis_theta'] = new_df['spin_axis_theta'].astype(float).round(2)
            new_df['spin_axis_phi'] = new_df['spin_axis_phi'].astype(float).round(2)
            new_dict = {key: value[0] if value else None for key, value in new_df.to_dict(orient="list").items()}
            return render_template('calculator.html', **form_data, **new_dict, target_variation=session['target_variation'], target_variations=session['target_variations'])
    
        else:
            form_data = {
                "pitch_hand": None,
                "velocity": 0,
                "spin_rate": 0,
                "trackman_h_break": 0,
                "v_break": 0,
                "release_x_ft": 0,
                "release_z_ft": 0,
                "spin_efficiency": 0,
            }
   
    return render_template('calculator.html')

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000, debug=False)