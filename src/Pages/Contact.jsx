import React, { useRef, useState } from 'react'
import './Contact.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPhone, faEnvelope} from '@fortawesome/free-solid-svg-icons'
import emailjs from '@emailjs/browser';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'
import { toast } from 'react-toastify';

const Contact = () => {

  const [isSending, setIsSending] = useState(false);

  const form = useRef();

  const sendEmail = (e) => {
    e.preventDefault();
    setIsSending(true)
    emailjs.sendForm(
      'service_9irgjua',
      'template_n5w0r7b',
      form.current,
      'GL1hSa2TuOXGaNGo5'
    )
    
    .then((result) => {

      console.log('Success!', result.text); toast.success("Message sent successfully!"); e.target.reset();}, (error) => {

      })
       .catch((error) => {console.log('Failed...', error.text); toast.error("Something went wrong, please try again"); 

      })
      .finally(() => {
        setIsSending(false);
      })
    }
    
  return (
    <>
       <section id="contact">
        <div className="contact__container">
          <h3 className="contact__title">
            Send Us a Message
          </h3>
          <form ref={form} onSubmit={sendEmail} className="contact__input--container">
  
            <input type="name" name="name" placeholder="Enter your First Name" required />
           
            <input type="name" name="name" placeholder="Enter your Last Name" required />
            <input type="email" name="user_email" placeholder="Enter your Email" required />
            <textarea name="message" placeholder="Enter your Message" required />
            <button type="submit" disabled={isSending} className="btn">{isSending ? "Sending...": "Send Message"}</button>
          </form>
          </div>
          <div className="contact__info--container">
            <h3 className="contact_info--title">
              Contact Us
            </h3>
            <p className="phone_number"><FontAwesomeIcon icon={faPhone} /> Phone: <a className="phone" href="tel:3525386816">(352) 538-6816</a></p>
            <p className="email_address"><FontAwesomeIcon icon={faEnvelope} /> Email: <a className="email" href="mailto:andreworeilly04@gmail.com">andreworeilly04@gmail.com</a></p>
          </div>
       </section>
    </>
  )
}

export default Contact;