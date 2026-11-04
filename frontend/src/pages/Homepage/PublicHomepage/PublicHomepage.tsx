import HeroSection from './components/HeroSection/HeroSection';
import HistorySection from './components/HistorySection/HistorySection';
import PartnersSection from './components/PartnersSection/PartnersSection';
import ProgrammingSection from './components/ProgrammingSection/ProgrammingSection';
import PublicTopBar from './components/PublicTopBar/PublicTopBar';
import SignupSection from './components/SignupSection/SignupSection';
import SiteFooter from './components/SiteFooter/SiteFooter';
import TeamSection from './components/TeamSection/TeamSection';

import { useHomepageImages } from './hooks/useHomepageImages';
import { useHomepagePrograms } from './hooks/useHomepagePrograms';
import { useSectionRouting } from './hooks/useSectionRouting';

import './PublicHomepage.css';
import '../../../common/styles/forms.css';

export default function PublicHomepage() {
  const imageQuery = useHomepageImages();
  const programQuery = useHomepagePrograms();
  useSectionRouting({ disabled: imageQuery.loading || programQuery.loading });

  const managedPhotos = imageQuery.images.map((image) => ({
    src: image.imageUrl,
    mobileSrc: image.mobileUrl,
    alt: image.altText,
    caption: image.caption,
  }));

  return (
    <div className="homepage-theme">
      <PublicTopBar />
      <main className="homepage-container homepage-theme">
        <HeroSection
          photos={managedPhotos}
          loading={imageQuery.loading}
          error={imageQuery.error}
          onRetry={() => void imageQuery.refresh()}
        />
        <ProgrammingSection
          programs={programQuery.programs}
          loading={programQuery.loading}
          error={programQuery.error}
          onRetry={() => void programQuery.refresh()}
        />
        <SignupSection />
        <HistorySection />
        <TeamSection />
        <PartnersSection />
        <SiteFooter />
      </main>
    </div>
  );
}
