from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import json

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///todo.db'
db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    todos = db.relationship('Todo', backref='user', lazy=True)
    categories = db.relationship('Category', backref='user', lazy=True)

class Todo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(500))
    completed = db.Column(db.Boolean, default=False)
    priority = db.Column(db.String(20), default='medium')
    due_date = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    color = db.Column(db.String(7), default='#2575fc')
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    todos = db.relationship('Todo', backref='category', lazy=True)

with app.app_context():
    db.create_all()

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/')
@login_required
def index():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        user = User.query.filter_by(email=request.form.get('email')).first()
        if user and check_password_hash(user.password_hash, request.form.get('password')):
            login_user(user)
            return redirect(url_for('index'))
        flash('خطأ في البريد الإلكتروني أو كلمة المرور')
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        
        if User.query.filter_by(email=email).first():
            flash('البريد الإلكتروني مستخدم بالفعل')
            return redirect(url_for('register'))
        
        user = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password)
        )
        db.session.add(user)
        db.session.commit()
        
        login_user(user)
        return redirect(url_for('index'))
    return render_template('register.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/api/todos', methods=['GET'])
@login_required
def get_todos():
    todos = Todo.query.filter_by(user_id=current_user.id).order_by(Todo.created_at.desc()).all()
    return jsonify([{
        'id': todo.id,
        'title': todo.title,
        'description': todo.description,
        'completed': todo.completed,
        'priority': todo.priority,
        'due_date': todo.due_date.isoformat() if todo.due_date else None,
        'category': {
            'id': todo.category.id,
            'name': todo.category.name,
            'color': todo.category.color
        } if todo.category else None
    } for todo in todos])

@app.route('/api/todos', methods=['POST'])
@login_required
def create_todo():
    data = request.json
    todo = Todo(
        title=data['title'],
        description=data.get('description', ''),
        priority=data.get('priority', 'medium'),
        due_date=datetime.fromisoformat(data['due_date']) if data.get('due_date') else None,
        category_id=data.get('category_id'),
        user_id=current_user.id
    )
    db.session.add(todo)
    db.session.commit()
    return jsonify({'id': todo.id})

@app.route('/api/todos/<int:todo_id>', methods=['PUT'])
@login_required
def update_todo(todo_id):
    todo = Todo.query.get_or_404(todo_id)
    if todo.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.json
    todo.title = data.get('title', todo.title)
    todo.description = data.get('description', todo.description)
    todo.completed = data.get('completed', todo.completed)
    todo.priority = data.get('priority', todo.priority)
    todo.due_date = datetime.fromisoformat(data['due_date']) if data.get('due_date') else todo.due_date
    todo.category_id = data.get('category_id', todo.category_id)
    
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/todos/<int:todo_id>', methods=['DELETE'])
@login_required
def delete_todo(todo_id):
    todo = Todo.query.get_or_404(todo_id)
    if todo.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    db.session.delete(todo)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/categories', methods=['GET'])
@login_required
def get_categories():
    categories = Category.query.filter_by(user_id=current_user.id).all()
    return jsonify([{
        'id': category.id,
        'name': category.name,
        'color': category.color
    } for category in categories])

@app.route('/api/categories', methods=['POST'])
@login_required
def create_category():
    data = request.json
    category = Category(
        name=data['name'],
        color=data.get('color', '#2575fc'),
        user_id=current_user.id
    )
    db.session.add(category)
    db.session.commit()
    return jsonify({'id': category.id})

@app.route('/api/stats', methods=['GET'])
@login_required
def get_stats():
    total_todos = Todo.query.filter_by(user_id=current_user.id).count()
    completed_todos = Todo.query.filter_by(user_id=current_user.id, completed=True).count()
    categories = Category.query.filter_by(user_id=current_user.id).all()
    category_stats = [{
        'name': cat.name,
        'count': Todo.query.filter_by(category_id=cat.id).count()
    } for cat in categories]
    
    return jsonify({
        'total': total_todos,
        'completed': completed_todos,
        'categories': category_stats
    })

if __name__ == '__main__':
    app.run(debug=True)
