import { useState, useMemo, useEffect } from "react";

type Props = {
  closeAt: number;
  totalMinted: number;
};

export const CountdownTimer = ({ closeAt, totalMinted }: Props) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isExpired, setIsExpired] = useState(false);

  // Convert closeAt to a Date object and format it
  const closeDate = useMemo(() => {
    const date = new Date(closeAt * 1000);
    return {
      full: date.toLocaleString(),
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
    };
  }, [closeAt]);

  useEffect(() => {
    function calculateTimeLeft() {
      const now = Math.floor(Date.now() / 1000);
      const difference = closeAt - now;

      if (difference <= 0) {
        setIsExpired(true);
        return {
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
        };
      }

      return {
        days: Math.floor(difference / 86400),
        hours: Math.floor((difference % 86400) / 3600),
        minutes: Math.floor((difference % 3600) / 60),
        seconds: difference % 60,
      };
    }

    // Initial calculation
    setTimeLeft(calculateTimeLeft());

    // Update every second
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);
    }, 1000);

    // Cleanup
    return () => clearInterval(timer);
  }, [closeAt]);

  // Pad single digits with leading zero
  const pad = (num: number) => String(num).padStart(2, "0");

  if (isExpired) {
    return (
      <div className="flex justify-between">
        <p className="text-sm text-gray-500">
          {totalMinted.toLocaleString()} minted
        </p>
        <p className="text-sm text-gray-500 text-end">
          Mint closed on {closeDate.full}
        </p>
      </div>
    );
  }

  const timeString = `${
    timeLeft.days > 0 ? `${timeLeft.days} days, ` : ""
  }${pad(timeLeft.hours)}h ${pad(timeLeft.minutes)}m ${pad(timeLeft.seconds)}s`;

  return (
    <div className="flex justify-between">
      <p className="text-sm text-gray-500">
        {totalMinted.toLocaleString()} minted
      </p>
      <p className="text-sm text-gray-500 text-end">{timeString}</p>
    </div>
  );
};
