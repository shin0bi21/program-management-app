import Header from '../../common/components/Header/Header'
import './Homepage.css'

export default function Homepage() {
  return (
    <>
      <Header />
      <div className="homepage-container">
        <img 
          src="/logo.jpg" 
          alt="Logo"
          className="homepage-logo"
        />
      </div>
    </>
  )
}
