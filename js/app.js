<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CRM Casamento Perfeito</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        :root { --primary: #8A2BE2; --secondary: #FF69B4; --bg: #f4f7fa; --card: #ffffff; --text: #333; }
        body { background: linear-gradient(135deg, var(--primary), var(--secondary)); min-height: 100vh; font-family: 'Segoe UI', system-ui, sans-serif; color: var(--text); }
        .container-main { max-width: 1200px; margin: 2rem auto; padding: 0 1rem; }
        .header { background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); padding: 2rem; border-radius: 16px; text-align: center; color: white; margin-bottom: 1.5rem; }
        .nav-tabs-custom { background: white; padding: 0.5rem; border-radius: 12px; display: flex; gap: 0.5rem; overflow-x: auto; margin-bottom: 1.5rem; }
        .nav-tab { padding: 0.8rem 1.5rem; border-radius: 8px; cursor: pointer; white-space: nowrap; transition: 0.3s; font-weight: 500; color: #666; }
        .nav-tab:hover { background: #f0f0f0; }
        .nav-tab.active { background: var(--primary); color: white; box-shadow: 0 4px 12px rgba(138,43,226,0.3); }
        .tab-content { display: none; }
        .tab-content.active { display: block; animation: fadeIn 0.3s; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .card { background: var(--card); border-radius: 16px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: none; }
        .stat-box { text-align: center; padding: 1.5rem; background: white; border-radius: 12px; border-left: 4px solid var(--primary); }
        .stat-value { font-size: 1.8rem; font-weight: 700; color: var(--text); }
        .stat-label { color: #777; font-size: 0.9rem; }
        .badge { padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.8rem; }
        .badge-success { background: #e6f4ea; color: #1e7e34; }
        .badge-warning { background: #fff8e1; color: #b7791f; }
        .badge-danger { background: #fde8e8; color: #c53030; }
        .badge-info { background: #e3f2fd; color: #1976d2; }
        .btn { border-radius: 8px; padding: 0.5rem 1rem; font-weight: 500; }
        .btn-primary { background: var(--primary); border: none; }
        .btn-success { background: #10b981; border: none; }
        .btn-danger { background: #ef4444; border: none; }
        .btn-outline { background: transparent; border: 1px solid var(--primary); color: var(--primary); }
        .btn-sm { padding: 0.3rem 0.6rem; font-size: 0.85rem; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #eee; }
        th { color: #666; font-weight: 500; }
        .modal { display: none; position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.5); z-index: 1000; justify-content: center; align-items: center; }
        .modal-content { background: white; padding: 2rem; border-radius: 16px; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto; }
        .form-group { margin-bottom: 1rem; }
        .form-label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555; }
        .form-control { width: 100%; padding: 0.7rem; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; }
        .form-control:focus { border-color: var(--primary); outline: none; box-shadow: 0 0 0 3px rgba(138,43,226,0.1); }
        .progress { background: #eee; border-radius: 8px; height: 8px; overflow: hidden; }
        .progress-bar { background: var(--primary); height: 100%; transition: width 0.5s; }
        .status-message { padding: 1rem; border-radius: 8px; margin-bottom: 1rem; display: none; }
        .status-success { background: #e6f4ea; color: #1e7e34; }
        .status-error { background: #fde8e8; color: #c53030; }
        .d-flex { display: flex; } .justify-between { justify
