<?php
/**
 * RedTaxi Backend - Lookup Controller
 * Public catalogue lookups (vehicle categories, coupons, offers, fare rules).
 */

require_once __DIR__ . '/BaseController.php';
require_once dirname(__DIR__) . '/models/LookupModel.php';
require_once dirname(__DIR__) . '/utils/Response.php';

class LookupController extends BaseController
{
    /** @var LookupModel */
    private $lookupModel;

    public function __construct()
    {
        $this->lookupModel = new LookupModel();
    }

    /**
     * GET /api/v1/lookup/vehicle-categories
     * Active vehicle categories for the customer app vehicle selector.
     */
    public function getVehicleCategories()
    {
        $categories = $this->lookupModel->getVehicleCategories();
        Response::success($categories, 'Vehicle categories retrieved successfully');
    }

    /**
     * GET /api/v1/lookup/coupons
     * Active, valid coupons for the customer app COUPONS screen.
     */
    public function getCoupons()
    {
        $coupons = $this->lookupModel->getCoupons();
        Response::success($coupons, 'Coupons retrieved successfully');
    }

    /**
     * GET /api/v1/lookup/offers
     * Active offers for the customer app OFFERS screen.
     */
    public function getOffers()
    {
        $offers = $this->lookupModel->getOffers();
        Response::success($offers, 'Offers retrieved successfully');
    }

    /**
     * GET /api/v1/lookup/fare-rules
     * Active fare rules with vehicle category names (FARE_DETAILS screen).
     */
    public function getFareRules()
    {
        $rules = $this->lookupModel->getFareRules();
        Response::success($rules, 'Fare rules retrieved successfully');
    }

    /**
     * GET /api/v1/places/search
     * Rapido-style location autocomplete search across Tamil Nadu
     */
    public function searchPlaces()
    {
        require_once dirname(__DIR__) . '/services/PlacesSearchService.php';
        $q = trim(isset($_GET['q']) ? $_GET['q'] : (isset($_GET['query']) ? $_GET['query'] : ''));
        $lat = (float)(isset($_GET['lat']) ? $_GET['lat'] : 11.6643);
        $lng = (float)(isset($_GET['lng']) ? $_GET['lng'] : 78.1460);
        $limit = min(20, max(1, (int)(isset($_GET['limit']) ? $_GET['limit'] : 10)));
        $results = PlacesSearchService::search($q, $lat, $lng, $limit);
        header('Content-Type: application/json; charset=utf-8');
        header('Access-Control-Allow-Origin: *');
        echo json_encode($results);
        exit;
    }
}