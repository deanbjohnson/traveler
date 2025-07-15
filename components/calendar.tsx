'use client';
import {
    CalendarBody,
    CalendarHeader,
    CalendarItem,
    CalendarProvider,
} from '@/components/ui/kibo-ui/calendar';


const Calendar = () => (
    <CalendarProvider>
        <CalendarHeader />
        <CalendarBody features={[]}>
            {({ feature }) => <CalendarItem feature={feature} key={feature.id} />}
        </CalendarBody>
    </CalendarProvider>
);
export default Calendar;
