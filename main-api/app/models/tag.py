from app import db

# Junction-Tabelle für Issue ↔ Tag (Many-to-Many)
issue_tags = db.Table(
    "issue_tags",
    db.Column("issue_id", db.Integer, db.ForeignKey("issues.id", ondelete="CASCADE"), primary_key=True),
    db.Column("tag_id", db.Integer, db.ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Tag(db.Model):
    __tablename__ = "tags"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    color = db.Column(db.String(7), default="#94a3b8")  # Hex-Farbe
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    # project_id = NULL → globaler Tag

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "color": self.color,
            "project_id": self.project_id,
        }
