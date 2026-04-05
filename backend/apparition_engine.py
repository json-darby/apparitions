import os
import json
import nest_asyncio
from dotenv import load_dotenv
from llama_index.core import (
    Document, 
    VectorStoreIndex, 
    Settings, 
    StorageContext, 
    load_index_from_storage
)
from llama_index.llms.mistralai import MistralAI
from llama_index.embeddings.mistralai import MistralAIEmbedding

"""Applies nest_asyncio to allow nested event loops in environments like FastAPI."""
nest_asyncio.apply()

class ApparitionEngine:
    """The robust, intelligent core for the Apparitions Dutch language application."""

    def __init__(self, db_filename="database.json", update_storage=False):
        """Initialises the engine, connects to the AI, and manages the persistence layer."""
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.db_path = os.path.join(self.base_dir, "lessons", db_filename)
        self.storage_dir = os.path.join(self.base_dir, "storage")
        
        self.database = []
        self.index = None
        
        self._initialise_ai()
        self._load_database()
        self._build_index(update_storage)

    def _initialise_ai(self):
        """Loads environment variables and configures the AI models."""
        env_path = os.path.join(self.base_dir, "../.env.local")
        load_dotenv(dotenv_path=env_path)
        api_key = os.getenv("APPARITIONS_LESSON_KEY_MISTRAL")
        
        """Configures Mistral, explicitly setting max_tokens to prevent JSON truncation."""
        Settings.llm = MistralAI(
            model="mistral-large-latest", 
            temperature=0.7, 
            max_tokens=2048, 
            api_key=api_key
        )
        Settings.embed_model = MistralAIEmbedding(model_name="mistral-embed", api_key=api_key)

    def _load_database(self):
        """Reads the static JSON curriculum from local storage."""
        try:
            with open(self.db_path, "r", encoding="utf-8") as f:
                self.database = json.load(f)
        except FileNotFoundError:
            print(f"Error: Could not find database at {self.db_path}.")

    def _build_index(self, update_storage):
        """Handles the logic for creating, saving, or loading the embedding index."""
        storage_exists = os.path.exists(self.storage_dir) and os.listdir(self.storage_dir)

        if not update_storage and storage_exists:
            """Loads the existing index from the local storage folder."""
            storage_context = StorageContext.from_defaults(persist_dir=self.storage_dir)
            self.index = load_index_from_storage(storage_context)
        else:
            """Creates a new index from the JSON database and persists it to the hard drive."""
            documents = []
            for lesson in self.database:
                doc = Document(
                    text=json.dumps(lesson), 
                    metadata={"lesson_id": lesson.get("lesson_id")}
                )
                documents.append(doc)

            self.index = VectorStoreIndex.from_documents(documents)
            self.index.storage_context.persist(persist_dir=self.storage_dir)
        
        print("Apparition Engine: Memory bank online.")

    def get_index(self):
        """Returns a lightweight list of all static lessons available."""
        return [
            {
                "id": lesson.get("lesson_id"),
                "title": lesson.get("metadata", {}).get("title", "Unknown"),
                "subtitle": lesson.get("metadata", {}).get("subtitle", ""),
                "scene": lesson.get("metadata", {}).get("scene", "")
            }
            for lesson in self.database
        ]

    def get_static_lesson(self, lesson_id):
        """Fetches a pre-written lesson directly from the local JSON database."""
        for lesson in self.database:
            if lesson.get("lesson_id") == lesson_id:
                return lesson
        return {"error": f"Lesson {lesson_id} not found."}

    def process_user_request(self, user_request, real_world_context="None"):
        """
        Analyses the user request to determine if it asks for a static lesson or a dynamic one.
        Directly checks the static database first to prevent unnecessary LLM API usage.
        
        Args:
            user_request (str): The requested topic or lesson ID.
            real_world_context (str, optional): Additional context for dynamic generation. Defaults to "None".
        
        Returns:
            dict: The JSON representation of the lesson, or an error dictionary.
        """
        if not self.index:
            return {"error": "Index not built."}

        """Short-circuit checking: if it is already a known static lesson ID, pull directly."""
        if user_request.startswith("nl_"):
            static_lesson = self.get_static_lesson(user_request)
            if "error" not in static_lesson:
                print(f"Retrieved static lesson (direct match): {user_request}")
                return static_lesson

        """Check if the text matches any title in the static database."""
        for lesson in self.database:
            title = lesson.get("metadata", {}).get("title", "").lower()
            if user_request.lower() == title:
                print(f"Retrieved static lesson (title match): {lesson.get('lesson_id')}")
                return lesson

        """If it reaches here, we assume it is a dynamic request and do not waste calls asking the LLM to classify it as static or dynamic."""
        print(f"Conjuring custom lesson about: {user_request[:40]}...")
        return self._generate_dynamic_lesson(user_request, real_world_context)

    def _generate_dynamic_lesson(self, topic, real_world_context):
        """Conjures a brand new JSON lesson using expanded LLM knowledge matching the new schema."""
        query_engine = self.index.as_query_engine(response_mode="compact")

        prompt = f"""
        You are the intelligent core of the 'Apparitions' Dutch language app.
        Use your comprehensive knowledge of the Dutch language to create a brand new, dynamic lesson. 

        Target Topic: {topic}
        Real World Context: {real_world_context}

        INSTRUCTIONS:
        1. Select the most appropriate "template" based on the topic. There are exactly five available templates, each with a distinct use:
           - "Audio_List": Use for a standard, flat list of vocabulary or phrases.
           - "Grid_Interactive": Use for short, visually grid-based items (single words, short phrases).
           - "Sequence_List": Use when the order of items matters, such as step-by-step instructions or navigation.
           - "Dialogue_Scenario": Use for conversations between two speakers (use 'you' or 'them' for speaker field).
           - "Grouped_List": Use when words or phrases fit naturally into categories (use 'group' field for each asset).
        2. Generate an appropriate number of assets to cover the scenario.
        3. CRITICAL: Ensure all Dutch vocabulary and grammar strictly adheres to CEFR A1 and A2 levels.
        4. Aesthetics: Write the "scene" and "content" introductions in a melancholic, Nocturnal Brutalist style.
        5. You MUST strictly adhere to the exact JSON schema provided below.

        Output ONLY valid JSON.
        
        JSON Structure:
        {{
            "lesson_id": "nl_dynamic_1",
            "metadata": {{
                "title": "Custom: [2-3 word summary]",
                "subtitle": "[Incorporate the context provided]",
                "template": "[Audio_List, Grid_Interactive, Dialogue_Scenario, etc.]",
                "content_type": "[dialogue, vocabulary, or grammar]",
                "level": "a1",
                "tts_lang": "nl-NL",
                "scene": "[Melancholic scene description setting the mood]",
                "groups": null,
                "next_lesson": "END_OF_COURSE"
            }},
            "content": "[English explanation fitting the aesthetic]",
            "assets": [
                {{
                    "dutch": "[Dutch text]",
                    "english": "[English translation]",
                    "type": "[word, phrase, phoneme, or letter]",
                    "tts": "[Cleaned text for text-to-speech, without punctuation]",
                    "pronunciation": "[Phonetic pronunciation guide]",
                    "audio": null,
                    "group": "[If Grouped_List, use category name, otherwise null]",
                    "speaker": "[If Dialogue_Scenario, use 'you' or 'them', otherwise null]"
                }}
            ]
        }}
        """

        response = query_engine.query(prompt)
        raw_output = response.response.strip()
        
        """Cleans the output to ensure strict JSON parsing."""
        if raw_output.startswith("```json"):
            raw_output = raw_output[7:-3].strip()
        elif raw_output.startswith("```"):
            raw_output = raw_output[3:-3].strip()
            
        try:
            return json.loads(raw_output)
        except json.JSONDecodeError:
            return {"error": "Failed to parse AI output as JSON", "raw_output": raw_output}

if __name__ == "__main__":
    """
    Initialise the engine. 
    Set update_storage=True only if you have changed your database.json file.
    """
    engine = ApparitionEngine(update_storage=False)

    print("\n--- TEST: DYNAMIC DIALOGUE SCENARIO ---")
    context = "10:00 AM, a quiet Dutch bakery. It is raining outside."
    topic = "Ordering a warm stroopwafel and a tea."
    
    response = engine.process_user_request(topic, context)
    print(json.dumps(response, indent=2))