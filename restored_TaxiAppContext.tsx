<?php
$pdo = new PDO('mysql:host=localhost;dbname=redtaxi_db;charset=utf8mb4', 'root', '');
$tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);

foreach ($tables as $table) {
    $cols = $pdo->query("DESCRIBE `$table`")->fetchAll(PDO::FETCH_ASSOC);
    $textCols = [];
    foreach ($cols as $col) {
        $type = strtolower($col['Type']);
        if (strpos($type, 'char') !== false || strpos($type, 'text') !== false) {
            $textCols[] = $col['Field'];
        }
    }
    
    foreach ($textCols as $col) {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM `$table` WHERE `$col` LIKE :term");
        $stmt->execute(['term' => '%redtaxi%']);
        $cnt = $stmt->fetchColumn();
        if ($cnt > 0) {
            echo "Table $table, Column $col has $cnt occurrences\n";
            // Show sample
            $s = $pdo->query("SELECT `$col` FROM `$table` WHERE `$col` LIKE '%redtaxi%' LIMIT 3")->fetchAll(PDO::FETCH_COLUMN);
            print_r($s);
        }
    }
}
