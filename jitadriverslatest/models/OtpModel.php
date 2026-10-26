<?php
/**
 * RedTaxi Backend - OTP Model
 * Handles OTP generation, storage, attempts tracking, and validation.
 * Compatible with PHP 5.6+.
 */

require_once __DIR__ . '/BaseModel.php';
require_once dirname(__DIR__) . '/config/env.php';
require_once dirname(__DIR__) . '/utils/Security.php';

class OtpModel extends BaseModel
{
    const DEMO_MASTER_OTP = '1234';
    const DEMO_ALT_OTP = '4821';

    public function createOtp($phone, $otp = null, $purpose = 'LOGIN', $expiresInMinutes = 10)
    {
        if ($otp === null) {
            $otp = Security::generateOtp(4);
        }

        $id = Security::generateUUID();
        $expiresAt = date('Y-m-d H:i:s', time() + ($expiresInMinutes * 60));

        $sql = "INSERT INTO `otp_verifications` (`id`, `phone`, `otp`, `purpose`, `is_verified`, `attempts`, `expires_at`, `created_at`)
                VALUES (?, ?, ?, ?, 0, 0, ?, NOW())";

        $this->query($sql, array($id, $phone, $otp, $purpose, $expiresAt));

        return array(
            'id'         => $id,
            'phone'      => $phone,
            'otp'        => $otp,
            'purpose'    => $purpose,
            'expires_at' => $expiresAt
        );
    }

    public function verifyOtp($phone, $enteredOtp, $purpose = 'LOGIN')
    {
        // 1. Allow demo mock OTP '4821' only for non-production development/testing
        $isNonProd = Env::get('APP_ENV') !== 'production';
        if ($isNonProd && ($enteredOtp === self::DEMO_MASTER_OTP || $enteredOtp === self::DEMO_ALT_OTP || $enteredOtp === '1234')) {
            return true;
        }

        // 2. Fetch latest active OTP for this phone & purpose
        $sql = "SELECT * FROM `otp_verifications`
                WHERE `phone` = ? AND `purpose` = ? AND `is_verified` = 0 AND `expires_at` >= NOW()
                ORDER BY `created_at` DESC
                LIMIT 1";
        $record = $this->fetchOne($sql, array($phone, $purpose));

        if (!$record) {
            return false;
        }

        // Check if exceeded max attempts
        if ((int)$record['attempts'] >= 5) {
            return false;
        }

        if ($record['otp'] === $enteredOtp) {
            // Mark verified
            $upSql = "UPDATE `otp_verifications` SET `is_verified` = 1 WHERE `id` = ?";
            $this->execute($upSql, array($record['id']));
            return true;
        } else {
            // Increment attempts
            $upSql = "UPDATE `otp_verifications` SET `attempts` = `attempts` + 1 WHERE `id` = ?";
            $this->execute($upSql, array($record['id']));
            return false;
        }
    }
}
