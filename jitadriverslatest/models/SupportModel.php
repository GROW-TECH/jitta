<?php
/**
 * RedTaxi Backend - Support Model
 * Handles support tickets and threaded conversation messages.
 * Compatible with PHP 5.6+.
 */

require_once __DIR__ . '/BaseModel.php';
require_once dirname(__DIR__) . '/utils/Security.php';

class SupportModel extends BaseModel
{
    private function getTicketColumns()
    {
        $cols = array();
        try {
            $stmt = $this->db->query("SHOW COLUMNS FROM `support_tickets`");
            if ($stmt) {
                while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $cols[strtolower($r['Field'])] = true;
                }
            }
        } catch (Exception $e) {}
        return $cols;
    }

    public function createTicket($customerId, $data)
    {
        $id = Security::generateUUID('TCK-');
        $category = isset($data['category']) ? trim($data['category']) : 'General';
        $subject = isset($data['subject']) ? trim($data['subject']) : 'Support Request';
        $description = isset($data['description']) ? trim($data['description']) : '';
        $bookingId = isset($data['booking_id']) && !empty($data['booking_id']) ? trim($data['booking_id']) : null;
        $priority = isset($data['priority']) && in_array(strtoupper($data['priority']), array('LOW','MEDIUM','HIGH','CRITICAL'), true)
            ? strtoupper($data['priority'])
            : 'MEDIUM';

        $this->beginTransaction();

        try {
            $cols = $this->getTicketColumns();
            $fields = array('`id`', '`user_id`', '`user_type`', '`subject`', '`status`', '`priority`', '`created_at`');
            $placeholders = array('?', '?', "'CUSTOMER'", '?', "'OPEN'", '?', 'NOW()');
            $params = array($id, $customerId, $subject, $priority);

            if (isset($cols['booking_id'])) {
                $fields[] = '`booking_id`';
                $placeholders[] = '?';
                $params[] = $bookingId;
            }
            if (isset($cols['category'])) {
                $fields[] = '`category`';
                $placeholders[] = '?';
                $params[] = $category;
            }
            if (isset($cols['description'])) {
                $fields[] = '`description`';
                $placeholders[] = '?';
                $params[] = $description;
            }

            $sql = "INSERT INTO `support_tickets` (" . implode(', ', $fields) . ") VALUES (" . implode(', ', $placeholders) . ")";
            $this->query($sql, $params);

            // Create initial threaded message
            $msgId = Security::generateUUID();
            $msgSql = "INSERT INTO `support_messages` (`id`, `ticket_id`, `sender_type`, `sender_id`, `message`, `created_at`)
                       VALUES (?, ?, 'CUSTOMER', ?, ?, NOW())";
            $this->query($msgSql, array($msgId, $id, $customerId, $description));

            $this->commit();

            return $this->getTicketDetail($customerId, $id);
        } catch (Exception $e) {
            $this->rollBack();
            throw $e;
        }
    }

    public function getCustomerTickets($customerId)
    {
        $cols = $this->getTicketColumns();
        $catCol = isset($cols['category']) ? "t.category" : "'General' AS category";
        $resCol = isset($cols['resolved_at']) ? "t.resolved_at" : "NULL AS resolved_at";

        $sql = "SELECT t.id, t.booking_id, {$catCol}, t.subject, t.status, t.priority,
                       {$resCol}, t.created_at, t.updated_at,
                       COUNT(m.id) AS messages_count
                FROM `support_tickets` t
                LEFT JOIN `support_messages` m ON m.ticket_id = t.id
                WHERE t.user_id = ? AND t.user_type = 'CUSTOMER'
                GROUP BY t.id
                ORDER BY t.created_at DESC";

        return $this->fetchAll($sql, array($customerId));
    }

    public function getTicketDetail($customerId, $ticketId)
    {
        $sql = "SELECT t.*
                FROM `support_tickets` t
                WHERE t.id = ? AND t.user_id = ? AND t.user_type = 'CUSTOMER'
                LIMIT 1";

        $ticket = $this->fetchOne($sql, array($ticketId, $customerId));
        if (!$ticket) {
            return null;
        }

        // Fetch threaded replies
        $msgSql = "SELECT `id`, `sender_type`, `sender_id`, `message`, `attachments`, `created_at`
                   FROM `support_messages`
                   WHERE `ticket_id` = ?
                   ORDER BY `created_at` ASC";
        $messages = $this->fetchAll($msgSql, array($ticketId));

        foreach ($messages as &$msg) {
            if (!empty($msg['attachments'])) {
                $msg['attachments'] = json_decode($msg['attachments'], true);
            }
        }

        $ticket['messages'] = $messages;
        return $ticket;
    }

    public function addMessage($customerId, $ticketId, $message)
    {
        $ticket = $this->getTicketDetail($customerId, $ticketId);
        if (!$ticket) {
            return null;
        }

        $msgId = Security::generateUUID();
        $sql = "INSERT INTO `support_messages` (`id`, `ticket_id`, `sender_type`, `sender_id`, `message`, `created_at`)
                VALUES (?, ?, 'CUSTOMER', ?, ?, NOW())";
        $this->query($sql, array($msgId, $ticketId, $customerId, trim($message)));

        // If ticket was closed/resolved, reopen it on customer reply
        if ($ticket['status'] === 'RESOLVED' || $ticket['status'] === 'CLOSED') {
            $this->execute("UPDATE `support_tickets` SET `status` = 'IN_PROGRESS', `updated_at` = NOW() WHERE `id` = ?", array($ticketId));
        }

        return $this->getTicketDetail($customerId, $ticketId);
    }
}
