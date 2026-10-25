<?php
require_once __DIR__ . "/db.php";

try {
    $stmt = $conn->query("SELECT id, name, role, game, discord, status, avatar FROM members ORDER BY id DESC");
    $members = $stmt->fetchAll();
} catch (PDOException $e) {
    $members = [];
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Members | REAPERZ</title>
  <link rel="stylesheet" href="../css/style.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;800;900&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>

  <!-- SITE HEADER -->
  <header class="site-header">
    <a class="logo" href="../index.html"><span>R</span> REAPERZ</a>
    <button class="menu-toggle" aria-label="Toggle navigation">☰</button>
    <nav>
      <a href="../index.html">Home</a>
      <a class="active" href="members.php">Members</a>
      <a href="../join.html">Join Us</a>
      <a href="../rules.html">Rules</a>
      <a href="../contact.html">Contact</a>
      <a class="nav-admin-link" href="../admin.html">Staff Portal</a>
    </nav>
  </header>

  <main class="page">
    <section class="page-title">
      <p class="eyebrow">THE CREW (PHP / SQL)</p>
      <h1>REAPERZ <span>MEMBERS</span></h1>
      <p>Loaded directly from the MySQL database.</p>
    </section>

    <section class="section">
      <div class="toolbar">
        <input id="memberSearch" type="search" placeholder="Search members...">
        <select id="roleFilter">
          <option value="">All Roles</option>
          <option value="Founder">Founder</option>
          <option value="Admin">Admin</option>
          <option value="Moderator">Moderator</option>
          <option value="Member">Member</option>
        </select>
      </div>

      <div class="members-grid" id="membersGrid">
        <?php if (!empty($members)): ?>
          <?php foreach ($members as $member): ?>
            <?php 
              $roleLower = strtolower($member['role'] ?? '');
              $badgeClass = ($roleLower === 'founder' || $roleLower === 'owner') ? 'founder' : (($roleLower === 'admin') ? 'admin' : (($roleLower === 'moderator') ? 'moderator' : ''));
              $isOnline = strtolower($member['status'] ?? 'Online') === 'online';
            ?>
            <article class="member"
                     data-name="<?= htmlspecialchars(strtolower($member['name']), ENT_QUOTES, 'UTF-8') ?>"
                     data-role="<?= htmlspecialchars($member['role'], ENT_QUOTES, 'UTF-8') ?>">
              <div class="avatar">
                <?php if (!empty($member['avatar'])): ?>
                  <img src="<?= htmlspecialchars($member['avatar'], ENT_QUOTES, 'UTF-8') ?>" alt="<?= htmlspecialchars($member['name'], ENT_QUOTES, 'UTF-8') ?>">
                <?php else: ?>
                  <?= htmlspecialchars(strtoupper(substr($member['name'], 0, 1)), ENT_QUOTES, 'UTF-8') ?>
                <?php endif; ?>
              </div>

              <h3><?= htmlspecialchars($member['name'], ENT_QUOTES, 'UTF-8') ?></h3>
              <small><?= htmlspecialchars($member['game'] ?? 'GTA V / FiveM', ENT_QUOTES, 'UTF-8') ?></small>

              <?php if (!empty($member['discord'])): ?>
                <div class="member-discord">Discord: <?= htmlspecialchars($member['discord'], ENT_QUOTES, 'UTF-8') ?></div>
              <?php endif; ?>

              <div class="member-status">
                <span class="status-dot <?= $isOnline ? 'online' : 'offline' ?>"></span>
                <?= htmlspecialchars($member['status'] ?? 'Offline', ENT_QUOTES, 'UTF-8') ?>
              </div>

              <span class="role <?= $badgeClass ?>"><?= htmlspecialchars($member['role'], ENT_QUOTES, 'UTF-8') ?></span>
            </article>
          <?php endforeach; ?>
        <?php else: ?>
          <p class="no-members">No members found in the MySQL database. Run <code>database.sql</code> to seed initial members.</p>
        <?php endif; ?>
      </div>
    </section>
  </main>

  <footer>
    <div>
      <a class="logo" href="../index.html"><span>R</span> REAPERZ</a>
      <p>Tamil GTA 5 Online &amp; FiveM Community</p>
    </div>
    <div class="footer-links">
      <a href="members.php">Members</a>
      <a href="../join.html">Join Us</a>
      <a href="../rules.html">Rules</a>
      <a href="../contact.html">Contact</a>
      <a href="../admin.html">Admin</a>
    </div>
    <p class="copyright">© 2026 REAPERZ. Built by REAPER ARAFATH. All rights reserved.</p>
  </footer>

  <script src="../js/main.js"></script>
  <script>
    // Client-side quick filter for the PHP rendered cards
    const search = document.getElementById("memberSearch");
    const filter = document.getElementById("roleFilter");
    const grid = document.getElementById("membersGrid");

    function filterCards() {
      const q = search.value.toLowerCase().trim();
      const r = filter.value.toLowerCase().trim();

      grid.querySelectorAll(".member").forEach(card => {
        const name = (card.dataset.name || "").toLowerCase();
        const role = (card.dataset.role || "").toLowerCase();
        const matchSearch = !q || name.includes(q);
        const matchRole = !r || role === r;
        card.style.display = matchSearch && matchRole ? "block" : "none";
      });
    }

    search?.addEventListener("input", filterCards);
    filter?.addEventListener("change", filterCards);
  </script>
</body>
</html>
