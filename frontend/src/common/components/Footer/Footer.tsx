import './Footer.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEnvelope, faHeart, faLocationDot, faPhone } from '@fortawesome/free-solid-svg-icons'

export default function Footer() {
  const contactEmail = 'beoriginalyouthgroup@gmail.com'
  const mailtoHref = `mailto:${contactEmail}`

  return (
    <footer className="site-footer" aria-label="Footer">
      <div className="site-footer-grid">
        <section className="site-footer-block site-footer-brand" aria-labelledby="footer-brand-title">
          <h3 id="footer-brand-title" className="site-footer-brand-title">
            <span className="site-footer-brand-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faHeart} />
            </span>
            <span>Be Original Youth Group</span>
          </h3>
          <p>
            Supporting local youth through mentorship, life skills, and career-focused
            programming across Sandwich and Windsor.
          </p>
        </section>

        <section className="site-footer-block" aria-labelledby="footer-contact-title">
          <h3 id="footer-contact-title">Contact Us</h3>
          <div className="site-footer-contact-item">
            <span className="site-footer-contact-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faEnvelope} />
            </span>
            <a href={mailtoHref}>{contactEmail}</a>
          </div>
          <div className="site-footer-contact-item">
            <span className="site-footer-contact-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faPhone} />
            </span>
            <a href="tel:+15551234567">(555) 123-4567</a>
          </div>
          <div className="site-footer-contact-item">
            <span className="site-footer-contact-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faLocationDot} />
            </span>
            <p>3735 King St, Windsor, ON N9C 2Z1</p>
          </div>
        </section>

        <section className="site-footer-block" aria-labelledby="footer-social-title">
          <h3 id="footer-social-title">Follow Us</h3>
          <div className="site-footer-socials">
            <a
              className="site-footer-social-link"
              href="https://www.facebook.com/BOYG2022"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M22 12.07C22 6.49 17.52 2 12 2S2 6.49 2 12.07c0 4.99 3.66 9.14 8.44 9.93v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.49-3.92 3.78-3.92 1.09 0 2.23.2 2.23.2v2.47h-1.25c-1.24 0-1.62.77-1.62 1.56v1.87h2.77l-.44 2.9h-2.33V22c4.78-.79 8.44-4.94 8.44-9.93z" />
              </svg>
            </a>
            <a
              className="site-footer-social-link"
              href="https://www.instagram.com/beoriginalyouthmentorship"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M7.75 2h8.5A5.76 5.76 0 0 1 22 7.75v8.5A5.76 5.76 0 0 1 16.25 22h-8.5A5.76 5.76 0 0 1 2 16.25v-8.5A5.76 5.76 0 0 1 7.75 2zm0 1.8A3.96 3.96 0 0 0 3.8 7.75v8.5a3.96 3.96 0 0 0 3.95 3.95h8.5a3.96 3.96 0 0 0 3.95-3.95v-8.5a3.96 3.96 0 0 0-3.95-3.95h-8.5zm8.95 1.35a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.8A3.2 3.2 0 1 0 12 15.2 3.2 3.2 0 0 0 12 8.8z" />
              </svg>
            </a>
          </div>
        </section>
      </div>

      <div className="site-footer-bottom">
        <p>Copyright {new Date().getFullYear()} Your Organization. All rights reserved.</p>
      </div>
    </footer>
  )
}
