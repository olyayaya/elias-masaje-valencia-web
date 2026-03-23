const MapBlock = () => (
  <div className="w-full aspect-video md:aspect-[21/9] rounded overflow-hidden border border-border">
    <iframe
      src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d12432.43!2d-0.3763!3d39.4699!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd604f4cf0efb06f%3A0xb4a351dee6856c2b!2sValencia%2C%20Spain!5e0!3m2!1sen!2s!4v1700000000000"
      width="100%"
      height="100%"
      style={{ border: 0 }}
      allowFullScreen
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      title="Ubicación de Elias Masaje en Valencia"
    />
  </div>
);

export default MapBlock;
