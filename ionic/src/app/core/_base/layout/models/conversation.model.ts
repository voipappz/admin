/**
 * Represents a single message in a call conversation/transcript
 */
export interface ConversationMessage {
    /** Unique message identifier */
    uuid: string;

    /** Who spoke this message */
    speaker: 'agent' | 'caller' | 'system';

    /** The transcribed text content */
    text: string;

    /** Timestamp within the call (seconds from start) */
    timestamp: number;

    /** Optional confidence score from speech-to-text (0-1) */
    confidence?: number;

    /** Optional speaker name if identified */
    speakerName?: string;
}

/**
 * Represents a full conversation transcript for a call
 */
export interface Conversation {
    /** The call UUID this conversation belongs to */
    callUuid: string;

    /** List of messages in chronological order */
    messages: ConversationMessage[];

    /** Call metadata */
    metadata: ConversationMetadata;

    /** Transcript generation status */
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'unavailable';

    /** Error message if status is 'failed' */
    error?: string;
}

/**
 * Metadata about the call for display in conversation header
 */
export interface ConversationMetadata {
    /** Contact name or number */
    contactName: string;

    /** Contact phone number */
    contactNumber: string;

    /** Call direction */
    direction: 'incoming' | 'outgoing' | 'missed';

    /** Call date/time */
    callDate: Date;

    /** Total call duration in seconds */
    duration: number;

    /** Agent/user who handled the call */
    agentName?: string;
}

/**
 * Factory functions for creating test/mock data
 */
export type MockConversationVariant = 'hebrew-billing' | 'hebrew-internet' | 'english';

export class ConversationFactory {
    /** Per-callUuid mapping populated by the calls list as it loads. */
    private static variantMap = new Map<string, MockConversationVariant>();

    /**
     * Register which mock variant a callUuid should resolve to. The calls page
     * assigns variants by position after each load so that the first call uses
     * the Hebrew billing transcript, the second uses the Hebrew internet
     * transcript, and everything else falls back to English.
     */
    static registerMockVariant(callUuid: string, variant: MockConversationVariant): void {
        ConversationFactory.variantMap.set(callUuid, variant);
    }

    /**
     * Creates a mock conversation for testing/development.
     * Routes by the variant registered for callUuid (set by the calls page).
     */
    static createMock(callUuid: string): Conversation {
        const variant = ConversationFactory.variantMap.get(callUuid);
        switch (variant) {
            case 'hebrew-billing':
                return ConversationFactory.createMockHebrewBilling(callUuid);
            case 'hebrew-internet':
                return ConversationFactory.createMockHebrewInternet(callUuid);
            default:
                return ConversationFactory.createMockEnglish(callUuid);
        }
    }

    /**
     * Default English mock conversation
     */
    private static createMockEnglish(callUuid: string): Conversation {
        return {
            callUuid,
            status: 'completed',
            metadata: {
                contactName: 'John Doe',
                contactNumber: '+1 555-123-4567',
                direction: 'incoming',
                callDate: new Date(),
                duration: 245,
                agentName: 'Support Agent'
            },
            messages: [
                {
                    uuid: '1',
                    speaker: 'system',
                    text: 'Call started',
                    timestamp: 0
                },
                {
                    uuid: '2',
                    speaker: 'agent',
                    text: 'Hello, thank you for calling. How can I help you today?',
                    timestamp: 3,
                    speakerName: 'Support Agent',
                    confidence: 0.95
                },
                {
                    uuid: '3',
                    speaker: 'caller',
                    text: 'Hi, I have a question about my account.',
                    timestamp: 8,
                    speakerName: 'John Doe',
                    confidence: 0.92
                },
                {
                    uuid: '4',
                    speaker: 'agent',
                    text: 'Of course! I\'d be happy to help. Could you please provide your account number?',
                    timestamp: 14,
                    speakerName: 'Support Agent',
                    confidence: 0.97
                },
                {
                    uuid: '5',
                    speaker: 'caller',
                    text: 'Sure, it\'s 12345678.',
                    timestamp: 22,
                    speakerName: 'John Doe',
                    confidence: 0.88
                },
                {
                    uuid: '6',
                    speaker: 'agent',
                    text: 'Thank you. I can see your account here. What would you like to know?',
                    timestamp: 30,
                    speakerName: 'Support Agent',
                    confidence: 0.94
                },
                {
                    uuid: '7',
                    speaker: 'caller',
                    text: 'I wanted to check when my next payment is due.',
                    timestamp: 38,
                    speakerName: 'John Doe',
                    confidence: 0.91
                },
                {
                    uuid: '8',
                    speaker: 'agent',
                    text: 'Your next payment of $150 is due on the 15th of this month.',
                    timestamp: 45,
                    speakerName: 'Support Agent',
                    confidence: 0.96
                },
                {
                    uuid: '9',
                    speaker: 'caller',
                    text: 'Perfect, thank you so much for your help!',
                    timestamp: 52,
                    speakerName: 'John Doe',
                    confidence: 0.93
                },
                {
                    uuid: '10',
                    speaker: 'agent',
                    text: 'You\'re welcome! Is there anything else I can help you with?',
                    timestamp: 58,
                    speakerName: 'Support Agent',
                    confidence: 0.95
                },
                {
                    uuid: '11',
                    speaker: 'caller',
                    text: 'No, that\'s all. Have a great day!',
                    timestamp: 65,
                    speakerName: 'John Doe',
                    confidence: 0.94
                },
                {
                    uuid: '12',
                    speaker: 'agent',
                    text: 'Thank you for calling. Goodbye!',
                    timestamp: 70,
                    speakerName: 'Support Agent',
                    confidence: 0.98
                },
                {
                    uuid: '13',
                    speaker: 'system',
                    text: 'Call ended',
                    timestamp: 75
                }
            ]
        };
    }

    /**
     * Hebrew customer-service conversation: billing inquiry (Partner cellular).
     */
    private static createMockHebrewBilling(callUuid: string): Conversation {
        return {
            callUuid,
            status: 'completed',
            metadata: {
                contactName: 'יעל כהן',
                contactNumber: '050-123-4567',
                direction: 'outgoing',
                callDate: new Date(),
                duration: 198,
                agentName: 'נציגת שירות - פרטנר'
            },
            messages: [
                {
                    uuid: '1',
                    speaker: 'system',
                    text: 'השיחה התחילה',
                    timestamp: 0
                },
                {
                    uuid: '2',
                    speaker: 'agent',
                    text: 'שלום, הגעת למוקד שירות הלקוחות של פרטנר, שמי נועה. במה אוכל לעזור?',
                    timestamp: 4,
                    speakerName: 'נועה',
                    confidence: 0.96
                },
                {
                    uuid: '3',
                    speaker: 'caller',
                    text: 'שלום נועה, קיבלתי את החשבונית של החודש והיא הרבה יותר גבוהה מהרגיל. רציתי להבין למה.',
                    timestamp: 11,
                    speakerName: 'יעל כהן',
                    confidence: 0.92
                },
                {
                    uuid: '4',
                    speaker: 'agent',
                    text: 'אין בעיה, אשמח לעזור. אפשר בבקשה את מספר הטלפון שמופיע על החשבונית ואת תעודת הזהות לזיהוי?',
                    timestamp: 19,
                    speakerName: 'נועה',
                    confidence: 0.97
                },
                {
                    uuid: '5',
                    speaker: 'caller',
                    text: 'בטח, המספר הוא 050-123-4567 ותעודת הזהות 034567891.',
                    timestamp: 28,
                    speakerName: 'יעל כהן',
                    confidence: 0.9
                },
                {
                    uuid: '6',
                    speaker: 'agent',
                    text: 'תודה רבה, רגע אחד אני בודקת... כן, אני רואה את החשבונית. החודש החיוב הוא 287 שקלים במקום 159 שקלים בממוצע.',
                    timestamp: 38,
                    speakerName: 'נועה',
                    confidence: 0.95
                },
                {
                    uuid: '7',
                    speaker: 'caller',
                    text: 'בדיוק, מה גרם להפרש?',
                    timestamp: 51,
                    speakerName: 'יעל כהן',
                    confidence: 0.94
                },
                {
                    uuid: '8',
                    speaker: 'agent',
                    text: 'אני רואה כאן שביצעת שיחות לחו"ל, בסך הכל 58 דקות לארצות הברית. אין לך כרגע חבילה בינלאומית פעילה.',
                    timestamp: 56,
                    speakerName: 'נועה',
                    confidence: 0.93
                },
                {
                    uuid: '9',
                    speaker: 'caller',
                    text: 'אה, נכון, נסעתי לבן משפחה שגר שם. שכחתי לגמרי שאין לי חבילה.',
                    timestamp: 69,
                    speakerName: 'יעל כהן',
                    confidence: 0.91
                },
                {
                    uuid: '10',
                    speaker: 'agent',
                    text: 'הבנתי. יש לנו חבילה בינלאומית ב-29 שקלים לחודש שכוללת 200 דקות לכל העולם. רוצה שאוסיף לך אותה?',
                    timestamp: 78,
                    speakerName: 'נועה',
                    confidence: 0.96
                },
                {
                    uuid: '11',
                    speaker: 'caller',
                    text: 'כן, נשמע משתלם. בבקשה תוסיפי.',
                    timestamp: 91,
                    speakerName: 'יעל כהן',
                    confidence: 0.93
                },
                {
                    uuid: '12',
                    speaker: 'agent',
                    text: 'מעולה, החבילה נוספה לחשבונך והיא בתוקף מהיום. ולגבי החיוב הנוכחי - אני מאשרת לך זיכוי חד-פעמי של 50 שקלים כמחווה.',
                    timestamp: 98,
                    speakerName: 'נועה',
                    confidence: 0.95
                },
                {
                    uuid: '13',
                    speaker: 'caller',
                    text: 'וואו, תודה רבה! זה ממש נחמד מצידכם.',
                    timestamp: 114,
                    speakerName: 'יעל כהן',
                    confidence: 0.94
                },
                {
                    uuid: '14',
                    speaker: 'agent',
                    text: 'בשמחה. הזיכוי יופיע בחשבונית הבאה. עוד משהו שאוכל לעזור בו?',
                    timestamp: 121,
                    speakerName: 'נועה',
                    confidence: 0.97
                },
                {
                    uuid: '15',
                    speaker: 'caller',
                    text: 'לא, זה הכל. תודה רבה נועה.',
                    timestamp: 131,
                    speakerName: 'יעל כהן',
                    confidence: 0.95
                },
                {
                    uuid: '16',
                    speaker: 'agent',
                    text: 'תודה שפנית אלינו, יום נעים!',
                    timestamp: 137,
                    speakerName: 'נועה',
                    confidence: 0.98
                },
                {
                    uuid: '17',
                    speaker: 'system',
                    text: 'השיחה הסתיימה',
                    timestamp: 142
                }
            ]
        };
    }

    /**
     * Hebrew customer-service conversation: slow internet troubleshooting (Bezeq).
     */
    private static createMockHebrewInternet(callUuid: string): Conversation {
        return {
            callUuid,
            status: 'completed',
            metadata: {
                contactName: 'רותם שפירא',
                contactNumber: '054-444-5555',
                direction: 'outgoing',
                callDate: new Date(),
                duration: 525,
                agentName: 'תמיכה טכנית - בזק'
            },
            messages: [
                {
                    uuid: '1',
                    speaker: 'system',
                    text: 'השיחה התחילה',
                    timestamp: 0
                },
                {
                    uuid: '2',
                    speaker: 'agent',
                    text: 'שלום, הגעת לתמיכה הטכנית של בזק, שמי דנה. איך אפשר לעזור?',
                    timestamp: 3,
                    speakerName: 'דנה',
                    confidence: 0.97
                },
                {
                    uuid: '3',
                    speaker: 'caller',
                    text: 'שלום דנה, יש לי בעיה עם האינטרנט בבית. כבר כמה ימים שהוא ממש איטי, בעיקר בערב.',
                    timestamp: 10,
                    speakerName: 'רותם',
                    confidence: 0.93
                },
                {
                    uuid: '4',
                    speaker: 'agent',
                    text: 'אני מצטערת לשמוע. בואי נבדוק את זה יחד. אפשר את מספר הלקוח או את מספר הטלפון של הבית?',
                    timestamp: 20,
                    speakerName: 'דנה',
                    confidence: 0.95
                },
                {
                    uuid: '5',
                    speaker: 'caller',
                    text: 'מספר הלקוח הוא 04578923.',
                    timestamp: 30,
                    speakerName: 'רותם',
                    confidence: 0.91
                },
                {
                    uuid: '6',
                    speaker: 'agent',
                    text: 'תודה. אני רואה את הקו שלך. מתי בערך התחילה הבעיה?',
                    timestamp: 38,
                    speakerName: 'דנה',
                    confidence: 0.96
                },
                {
                    uuid: '7',
                    speaker: 'caller',
                    text: 'לפני בערך שלושה ימים. בבוקר זה בסדר, אבל מהשעה שבע בערב זה נהיה כמעט בלתי שמיש.',
                    timestamp: 45,
                    speakerName: 'רותם',
                    confidence: 0.92
                },
                {
                    uuid: '8',
                    speaker: 'agent',
                    text: 'מבינה. אני מבצעת עכשיו בדיקה מרחוק על הקו ועל הראוטר שלך, רגע אחד בבקשה.',
                    timestamp: 57,
                    speakerName: 'דנה',
                    confidence: 0.94
                },
                {
                    uuid: '9',
                    speaker: 'caller',
                    text: 'בסדר גמור, אני ממתינה.',
                    timestamp: 67,
                    speakerName: 'רותם',
                    confidence: 0.93
                },
                {
                    uuid: '10',
                    speaker: 'agent',
                    text: 'אוקיי, מצאתי שני דברים. ראשית, יש עומס משמעותי בקו בשעות הערב באזור שלך, ושנית, הראוטר שלך מדגם ישן יחסית ולא תומך במהירות שאת משלמת עליה.',
                    timestamp: 95,
                    speakerName: 'דנה',
                    confidence: 0.95
                },
                {
                    uuid: '11',
                    speaker: 'caller',
                    text: 'אז מה אפשר לעשות?',
                    timestamp: 112,
                    speakerName: 'רותם',
                    confidence: 0.94
                },
                {
                    uuid: '12',
                    speaker: 'agent',
                    text: 'אני יכולה לשלוח אלייך טכנאי שיחליף את הראוטר לדגם חדש, ללא עלות. בנוסף אני פותחת קריאה לטיפול בעומס בקו.',
                    timestamp: 119,
                    speakerName: 'דנה',
                    confidence: 0.96
                },
                {
                    uuid: '13',
                    speaker: 'caller',
                    text: 'נהדר. מתי טכנאי יוכל להגיע?',
                    timestamp: 134,
                    speakerName: 'רותם',
                    confidence: 0.93
                },
                {
                    uuid: '14',
                    speaker: 'agent',
                    text: 'יש לי תור פנוי מחר בין ארבע לשש אחר הצהריים, או ביום חמישי בבוקר בין שמונה לעשר. מה מתאים יותר?',
                    timestamp: 142,
                    speakerName: 'דנה',
                    confidence: 0.95
                },
                {
                    uuid: '15',
                    speaker: 'caller',
                    text: 'מחר אחר הצהריים מצוין, אני בבית.',
                    timestamp: 158,
                    speakerName: 'רותם',
                    confidence: 0.94
                },
                {
                    uuid: '16',
                    speaker: 'agent',
                    text: 'מעולה. שריינתי לך תור למחר בין ארבע לשש. תקבלי SMS עם פרטי הטכנאי כשעה לפני ההגעה.',
                    timestamp: 165,
                    speakerName: 'דנה',
                    confidence: 0.97
                },
                {
                    uuid: '17',
                    speaker: 'caller',
                    text: 'תודה רבה דנה, באמת עזרת לי הרבה.',
                    timestamp: 180,
                    speakerName: 'רותם',
                    confidence: 0.95
                },
                {
                    uuid: '18',
                    speaker: 'agent',
                    text: 'בשמחה. בינתיים, את יכולה לנסות לכבות את הראוטר לחמש דקות ולהדליק שוב, זה לפעמים עוזר זמנית. עוד משהו?',
                    timestamp: 188,
                    speakerName: 'דנה',
                    confidence: 0.96
                },
                {
                    uuid: '19',
                    speaker: 'caller',
                    text: 'לא, זה הכל. תודה רבה ויום טוב.',
                    timestamp: 202,
                    speakerName: 'רותם',
                    confidence: 0.94
                },
                {
                    uuid: '20',
                    speaker: 'agent',
                    text: 'גם לך, יום נעים ושיהיה בהצלחה!',
                    timestamp: 209,
                    speakerName: 'דנה',
                    confidence: 0.98
                },
                {
                    uuid: '21',
                    speaker: 'system',
                    text: 'השיחה הסתיימה',
                    timestamp: 215
                }
            ]
        };
    }

    /**
     * Creates an empty/pending conversation
     */
    static createPending(callUuid: string): Conversation {
        return {
            callUuid,
            status: 'pending',
            metadata: {
                contactName: '',
                contactNumber: '',
                direction: 'incoming',
                callDate: new Date(),
                duration: 0
            },
            messages: []
        };
    }

    /**
     * Creates a failed conversation
     */
    static createFailed(callUuid: string, error: string): Conversation {
        return {
            callUuid,
            status: 'failed',
            error,
            metadata: {
                contactName: '',
                contactNumber: '',
                direction: 'incoming',
                callDate: new Date(),
                duration: 0
            },
            messages: []
        };
    }
}
