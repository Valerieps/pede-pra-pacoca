// A member's photo, or the first letter of the name when there is none.
export function Avatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  if (photoUrl) return <img className="avatar" src={photoUrl} alt="" referrerPolicy="no-referrer" />;
  return (
    <span className="avatar" aria-hidden="true">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
