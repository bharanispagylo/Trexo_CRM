import React from 'react';
import './BugCapture.css';

export default function BugCapture() {

  return (
    <div className="bugcapture-root">
      <div className="bugcapture-container">
        {/* HERO CARD & DOWNLOAD BANNER */}
        <div className="bugcapture-hero-card">
          <div className="bugcapture-hero-content">
            <h2 className="bugcapture-hero-title">Spagylo CRM Bug Capture</h2>
            <p className="bugcapture-hero-desc">
              Capture UI bugs, annotate elements, and send screenshots along with deep metadata directly to the CRM without leaving the browser tab.
            </p>
          </div>
          <div className="bugcapture-download-section">
            <a 
              href="/spagylo-bug-capture.zip" 
              download="spagylo-bug-capture.zip" 
              className="bugcapture-download-btn"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download Extension
            </a>
            <p className="bugcapture-file-size">Chrome Extension (v1.0.0)</p>
          </div>
        </div>

        {/* DETAILS GRID */}
        <div className="bugcapture-details-grid">
          {/* STEP BY STEP INSTALLATION */}
          <div className="bugcapture-card">
            <h3 className="bugcapture-card-title">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#2563eb" strokeWidth="2.5" style={{ transform: 'translateY(1px)' }}>
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 16 12 12 12 8"></polyline>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              Installation Steps
            </h3>
            
            <div className="steps-list">
              <div className="step-item">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h4 className="step-title">Download & Unpack</h4>
                  <p className="step-desc">
                    Click the download button above to save the extension package. Extract the <span className="step-code-inline">spagylo-bug-capture.zip</span> folder to a directory of your choice on your computer.
                  </p>
                </div>
              </div>

              <div className="step-item">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h4 className="step-title">Enable Developer Mode in Chrome</h4>
                  <p className="step-desc">
                    Open a new tab in Google Chrome, navigate to <span className="step-code-inline">chrome://extensions/</span>, and toggle the <strong>Developer mode</strong> switch in the top-right corner to <strong>ON</strong>.
                  </p>
                </div>
              </div>

              <div className="step-item">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h4 className="step-title">Load Unpacked Extension</h4>
                  <p className="step-desc">
                    Click the <strong>Load unpacked</strong> button in the top-left of the Extensions page. Select the extracted folder containing the extension files (ensure the folder contains <span className="step-code-inline">manifest.json</span> directly).
                  </p>
                </div>
              </div>

              <div className="step-item">
                <div className="step-number">4</div>
                <div className="step-content">
                  <h4 className="step-title">Pin for Quick Access</h4>
                  <p className="step-desc">
                    Click the puzzle icon in your Chrome toolbar and pin <strong>Spagylo CRM Bug Capture</strong> to your toolbar for easy access on any page.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SYSTEM CONFIG & FEATURES */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="bugcapture-card">
              <h3 className="bugcapture-card-title">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#10b981" strokeWidth="2.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                </svg>
                Key Features
              </h3>

              <div className="extension-features-list">
                <div className="feature-item">
                  <div className="feature-icon-wrapper">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <div className="feature-text-group">
                    <h4 className="feature-title">Annotate on Screen</h4>
                    <p className="feature-desc">Hover and click any UI element to comment directly on it with overlays.</p>
                  </div>
                </div>

                <div className="feature-item">
                  <div className="feature-icon-wrapper">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <div className="feature-text-group">
                    <h4 className="feature-title">Instant Synced Tickets</h4>
                    <p className="feature-desc">Reports immediately appear under the CRM's Bug Board for admin review.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
