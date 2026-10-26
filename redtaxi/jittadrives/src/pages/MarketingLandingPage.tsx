import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingNavbar } from '../components/landing/LandingNavbar';
import { LandingHero } from '../components/landing/LandingHero';
import { LandingFleet } from '../components/landing/LandingFleet';
import { LandingWhyAndSafety } from '../components/landing/LandingWhyAndSafety';
import { LandingCaptainCTA } from '../components/landing/LandingCaptainCTA';
import { LandingFooter } from '../components/landing/LandingFooter';
import { DownloadAppModal } from '../components/landing/DownloadAppModal';

export const MarketingLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);

  const handleBookRide = (pickup: string, drop: string) => {
    const params = new URLSearchParams();
    if (pickup) params.set('pickup', pickup);
    if (drop) params.set('drop', drop);
    const queryString = params.toString();
    navigate(`/customer${queryString ? `?${queryString}` : ''}`);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-[#E85D04]/20 selection:text-[#E85D04]">
      {/* Navigation Header */}
      <LandingNavbar
        onOpenDownloadModal={() => setDownloadModalOpen(true)}
      />

      {/* Hero Section with Quick Booking Widget */}
      <LandingHero onBookRide={handleBookRide} />

      {/* Services Section (Rapido-Inspired View-Only Showcase) */}
      <LandingFleet />

      {/* Why Choose Us & Safety First */}
      <LandingWhyAndSafety />

      {/* Captain Partner Onboarding CTA */}
      <LandingCaptainCTA onOpenDownloadModal={() => setDownloadModalOpen(true)} />

      {/* Rapido-Style Footer with Google Play */}
      <LandingFooter onOpenDownloadModal={() => setDownloadModalOpen(true)} />

      {/* Rapido-Style 2-Column Download App Modal */}
      <DownloadAppModal
        isOpen={downloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
      />
    </div>
  );
};

export default MarketingLandingPage;
