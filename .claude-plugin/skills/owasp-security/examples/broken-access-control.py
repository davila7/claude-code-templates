# OWASP Top 10 - A01: Broken Access Control
# For detailed guidance, see: owasp-comprehensive-security-skills.md#section-1-owasp-top-10-2025
#
# This example demonstrates broken access control vulnerabilities where users can
# access resources they shouldn't have permission to view or modify.

from flask import Flask, request, jsonify, session
from functools import wraps

app = Flask(__name__)
app.secret_key = "secret"

# Simulated user database
users_db = {
    1: {"name": "Alice", "email": "alice@example.com", "role": "user"},
    2: {"name": "Bob", "email": "bob@example.com", "role": "admin"},
    3: {"name": "Charlie", "email": "charlie@example.com", "role": "user"},
}

orders_db = {
    1: {"user_id": 1, "product": "Laptop", "price": 999},
    2: {"user_id": 1, "product": "Mouse", "price": 25},
    3: {"user_id": 2, "product": "Keyboard", "price": 75},
    4: {"user_id": 3, "product": "Monitor", "price": 300},
}

# ===== VULNERABLE: No Authorization Check =====
@app.route("/vulnerable/user/<int:user_id>", methods=["GET"])
def vulnerable_get_user(user_id):
    """
    VULNERABLE: No authorization check. Any authenticated user can view
    any other user's profile, including email and other sensitive data.
    """
    if user_id not in users_db:
        return jsonify({"error": "User not found"}), 404
    
    user = users_db[user_id]
    return jsonify(user), 200


# ===== VULNERABLE: No Function-Level Authorization =====
@app.route("/vulnerable/orders/<int:order_id>/refund", methods=["POST"])
def vulnerable_refund_order(order_id):
    """
    VULNERABLE: No check that user owns the order. Any authenticated user
    can refund any order, including other users' orders.
    """
    if order_id not in orders_db:
        return jsonify({"error": "Order not found"}), 404
    
    # Directly process refund without verifying ownership
    order = orders_db[order_id]
    return jsonify({
        "message": f"Refunded ${order['price']} for order {order_id}",
        "status": "success"
    }), 200


# ===== VULNERABLE: Client-Side Security Only =====
@app.route("/vulnerable/admin/settings", methods=["GET", "POST"])
def vulnerable_admin_settings():
    """
    VULNERABLE: Admin check only in frontend via hidden field.
    Server doesn't verify admin role; attacker can bypass by sending
    direct POST request without checking.
    """
    if request.method == "POST":
        # No server-side role verification!
        setting_name = request.form.get("setting")
        setting_value = request.form.get("value")
        
        # Just apply settings regardless of user's actual role
        return jsonify({
            "message": f"Setting {setting_name} updated to {setting_value}",
            "status": "success"
        }), 200
    
    return jsonify({"settings": "admin-panel"}), 200


# ===== SECURE: Server-Side Authorization Check =====
def require_auth(f):
    """Decorator to check if user is logged in."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function


def require_role(required_role):
    """Decorator to check if user has required role."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if "user_id" not in session:
                return jsonify({"error": "Unauthorized"}), 401
            
            user_id = session["user_id"]
            if user_id not in users_db:
                return jsonify({"error": "User not found"}), 404
            
            user = users_db[user_id]
            if user["role"] != required_role:
                return jsonify({"error": "Forbidden - insufficient permissions"}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


@app.route("/secure/user/<int:user_id>", methods=["GET"])
@require_auth
def secure_get_user(user_id):
    """
    SECURE: Server-side authorization check. Only allow users to view
    their own profile or admin viewing others.
    """
    current_user_id = session.get("user_id")
    current_user = users_db.get(current_user_id)
    
    # Authorization logic:
    # 1. User can view their own profile
    # 2. Admin can view any profile
    if current_user_id == user_id or current_user["role"] == "admin":
        if user_id not in users_db:
            return jsonify({"error": "User not found"}), 404
        return jsonify(users_db[user_id]), 200
    else:
        return jsonify({"error": "Forbidden - cannot view other users' profiles"}), 403


@app.route("/secure/orders/<int:order_id>/refund", methods=["POST"])
@require_auth
def secure_refund_order(order_id):
    """
    SECURE: Function-level authorization. Verify:
    1. Order exists
    2. Current user owns the order OR is admin
    3. Then process refund
    """
    current_user_id = session.get("user_id")
    current_user = users_db.get(current_user_id)
    
    if order_id not in orders_db:
        return jsonify({"error": "Order not found"}), 404
    
    order = orders_db[order_id]
    
    # Authorization: User owns order OR is admin
    if order["user_id"] != current_user_id and current_user["role"] != "admin":
        return jsonify({"error": "Forbidden - you do not own this order"}), 403
    
    # Now safe to process
    return jsonify({
        "message": f"Refunded ${order['price']} for order {order_id}",
        "status": "success"
    }), 200


@app.route("/secure/admin/settings", methods=["GET", "POST"])
@require_role("admin")
def secure_admin_settings():
    """
    SECURE: Server-side role verification using decorator.
    Admin endpoints require explicit role check at function level.
    """
    if request.method == "POST":
        setting_name = request.form.get("setting")
        setting_value = request.form.get("value")
        
        return jsonify({
            "message": f"Setting {setting_name} updated to {setting_value}",
            "status": "success"
        }), 200
    
    return jsonify({"settings": "admin-panel"}), 200


# ===== CHECKLIST =====
"""
✓ Authorization on server for all sensitive ops (not just frontend)
✓ Default-deny principle (explicitly allow, don't assume access)
✓ No reliance on client-side security (role/admin flags, hidden fields)
✓ Verify user owns resource before allowing modifications
✓ Implement function-level authorization for API endpoints
✓ Use decorators/middleware for consistent access control
✓ Log all access control failures for monitoring
✓ Test with multiple user roles (user, admin, attacker)
"""
