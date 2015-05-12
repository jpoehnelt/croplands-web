from flask import Flask, render_template, make_response, Response, request
from functools import wraps
import requests


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
app.config['VERSION'] = '2.0.8'
app.config['CDN'] = 'https://www.croplands.org/static'


@app.route('/')
@cache(300)
def index(*args, **kwargs):
    return render_template('home.html', version=app.config['VERSION'], cdn=app.config['CDN'])


@app.route('/app/<path:path>')
@cache(0)
def angular_app(path=None):
    return render_template('app.html', version=app.config['VERSION'], cdn=app.config['CDN'])


@app.route('/s3/<path:path>')
@cache(1800)
def s3_proxy(path=None):
    print request.headers
    def generate():
        r = requests.get('https://s3.amazonaws.com/gfsad30/' + path, stream=True)
        for chunk in r.raw.read(1024 * 1024):
            yield chunk

    return Response(response=generate(), content_type='application/javascript',
                    headers={'content-encoding': 'gzip'})


@app.errorhandler(404)
@cache(0)
def not_found(e):
    return render_template('404.html', version=app.config['VERSION'],
                           cdn=app.config['CDN']), 404

if __name__ == '__main__':
    app.config['CDN'] = '/static'
    app.run(debug=True)