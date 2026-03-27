"""
Hilfsskript zum Anlegen eines neuen Benutzers.

Verwendung:
    python create_user.py
"""
from app import create_app, db
from app.models.user import User


def create_user(name: str, password: str):
    app = create_app()
    with app.app_context():
        if User.query.filter_by(name=name).first():
            print(f"Benutzer '{name}' existiert bereits.")
            return

        user = User(name=name)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        print(f"Benutzer '{name}' erfolgreich erstellt (ID: {user.id}).")


if __name__ == "__main__":
    import getpass
    name = input("Benutzername: ").strip()
    password = getpass.getpass("Passwort: ")
    if not name or not password:
        print("Fehler: Name und Passwort dürfen nicht leer sein.")
    else:
        create_user(name, password)
