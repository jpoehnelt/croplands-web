from flask import Flask, render_template, make_response, Response, g
from functools import wraps
import requests
import os

def cache(seconds=0):
    def wrapper(fn):
        @wraps(fn)
        def view(*args, **kwargs):
            resp = make_response(fn(*args, **kwargs))
            if seconds == 0:
                resp.cache_control.no_cache = True
            else:
                resp.cache_control.max_age = seconds
            return resp

        return view

    return wrapper


app = Flask(__name__)
app.config['VERSION'] = '3.5.8'
app.config['SERVER_ADDRESS'] = os.environ.get('SERVER_ADDRESS', 'https://api.croplands.org')

@app.before_request
def set_server_address():
    g.server_address = app.config['SERVER_ADDRESS']

@app.route('/')
@cache(300)
def index(*args, **kwargs):
    return render_template('home.html', version=app.config['VERSION'])

@app.route('/data')
@cache(300)
def data_page(*args, **kwargs):
    return render_template('data.html', version=app.config['VERSION'])


@app.route('/app/<path:path>')
@cache(0)
def angular_app(path=None):
    return render_template('app.html', version=app.config['VERSION'])

@app.route('/s3/<path:path>')
@cache(300)
def s3_proxy(path=None):
    """ This view acts as a proxy to s3.
    :param path: str
    :return: Response
    """
    def generate():
        r = requests.get('https://s3.amazonaws.com/gfsad30/' + path, stream=True)
        for chunk in r.raw.read(1024 * 1024):
            yield chunk

    return Response(response=generate(), content_type='application/javascript',
                    headers={'content-encoding': 'gzip'})

@app.route('/mobile')
def mobile():
    return render_template('mobile.html', version=app.config['VERSION'])

@app.errorhandler(404)
@cache(0)
def not_found(e):
    return render_template('404.html', version=app.config['VERSION']), 404

if __name__ == '__main__':
    app.run(debug=True)