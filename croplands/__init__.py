from flask import Flask, render_template


app = Flask(__name__)
app.config['VERSION'] = '2.0.4'
app.config['CDN'] = 'https://hwstatic.croplands.org'

@app.route('/')
def index(*args, **kwargs):
    return render_template('home.html', version=app.config['VERSION'], cdn=app.config['CDN'])

@app.route('/app/<path:path>')
def angular_app(path=None):
    return render_template('app.html', version=app.config['VERSION'], cdn=app.config['CDN'])

@app.errorhandler(404)
def not_found(e):
    return render_template('404.html', version=app.config['VERSION'], cdn=app.config['CDN']), 404

if __name__ == '__main__':
    app.config['CDN'] = '/static'
    app.run(debug=True)